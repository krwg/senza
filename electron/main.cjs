const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const { exportLibrary, importLibrary } = require('./library-backup.cjs');
const { startWatch, stopWatch } = require('./watched-folder.cjs');
const { findLyricsForTrack, lyricAtTime } = require('./lyrics.cjs');
const { canWriteTags } = require('./tags.cjs');
const { onnxStatus } = require('./glyph-onnx.cjs');
const path = require('path');
const { existsSync } = require('fs');
const { pathToFileURL } = require('url');
const crypto = require('crypto');
const fs = require('fs/promises');
const { readTags, writeTags } = require('./tags.cjs');
const { resolveLibraryAudioPath } = require('./import.cjs');
const { validateSaveState, validateTrack, isUnderDir } = require('./state-validator.cjs');
const { normalizeImportMeta } = require('./glyph-import-meta.cjs');
const { extractGlyphFeatures } = require('./glyph-features.cjs');
const { saveCoverFile, coverExists, extractAndStoreCover, getCoverPath } = require('./covers.cjs');
const { saveArtistAvatar, artistAvatarUrl } = require('./artist-avatars.cjs');
const { getLibraryTree } = require('./library-tree.cjs');
const fsSync = require('fs');
const {
  listPlaylists,
  createPlaylist,
  savePlaylist,
  deletePlaylist,
} = require('./playlists.cjs');
const {
  ensureGlyphDirs,
  appendLearnEntry,
  getLearnStats,
  exportLearnBundle,
  buildEntryFromTrack,
} = require('./glyph-learn.cjs');
const {
  getGlyphMiStatus,
  glyphAnalyze,
  glyphVaultScan,
  glyphReloadKnowledge,
} = require('./glyph-mi.cjs');
const {
  musicBrainzLookup,
  acoustidLookup,
  fingerprintFile,
  downloadChromaprintTools,
  getOnlineStatus,
} = require('./glyph-online.cjs');
const { importExportToPrivatePack } = require('./glyph-import.cjs');
const {
  upsertTrackFeatures,
  upsertManyTracks,
  getLibraryFeatureRows,
} = require('./glyph-db.cjs');
const { rebuildLearnedPack, loadLearnedPack } = require('./glyph-learn-rules.cjs');
const {
  logEvent: logGlyphSqlEvent,
  getLogStats: getGlyphLogStats,
  getAnalytics: getGlyphAnalytics,
  writeDatasetExport: exportGlyphDataset,
} = require('./glyph-log-db.cjs');

const isDev = process.env.NODE_ENV === 'development';
const AUDIO_EXT = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac']);

let mainWindow = null;

function getAppIcon() {
  const ico = path.join(__dirname, '../build/icon.ico');
  const png = path.join(__dirname, '../build/icon.png');
  const candidate = existsSync(ico) ? ico : existsSync(png) ? png : null;
  if (!candidate) return undefined;
  const image = nativeImage.createFromPath(candidate);
  return image.isEmpty() ? undefined : image;
}

function getLibraryRoot() {
  return path.join(app.getPath('userData'), 'library');
}

function getStatePath() {
  return path.join(app.getPath('userData'), 'senza-state.json');
}

async function ensureLibrary() {
  const root = getLibraryRoot();
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(path.join(root, 'music'), { recursive: true });
  await fs.mkdir(path.join(root, 'covers'), { recursive: true });
  await fs.mkdir(path.join(root, 'playlists'), { recursive: true });
  await fs.mkdir(path.join(root, 'artists'), { recursive: true });
  await ensureGlyphDirs(root);
  return root;
}

function defaultState() {
  return {
    tracks: [],
    queue: [],
    queueIndex: 0,
    playlists: [],
    playHistory: [],
    settings: { theme: 'dark', locale: 'en', collectionMode: false, volume: 0.85, clickLock: false },
    profile: { displayName: 'senza-listener', avatarSeed: 'senza', useCustomAvatar: false },
  };
}

function sanitizeLoadedState(parsed, libraryRoot) {
  const result = validateSaveState(parsed, libraryRoot);
  if (result.ok) return result.state;

  // Soft-recover stored state: drop tracks whose paths escape the library.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.tracks)) {
    console.error('[senza] stored state invalid:', result.reason);
    return null;
  }
  const kept = [];
  for (let i = 0; i < parsed.tracks.length; i += 1) {
    const trackResult = validateTrack(parsed.tracks[i], libraryRoot, i);
    if (trackResult.ok) kept.push(trackResult.track);
    else console.error('[senza] dropping stored track:', trackResult.reason);
  }
  const retry = validateSaveState({ ...parsed, tracks: kept }, libraryRoot);
  if (!retry.ok) {
    console.error('[senza] stored state unrecoverable:', retry.reason);
    return null;
  }
  return retry.state;
}

async function loadState() {
  try {
    const raw = await fs.readFile(getStatePath(), 'utf8');
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeLoadedState(parsed, getLibraryRoot());
    const state = sanitized || defaultState();
    if (!state.settings) state.settings = { theme: 'dark', locale: 'en', collectionMode: false, volume: 0.85, clickLock: false };
    if (!state.profile) state.profile = { displayName: 'senza-listener', avatarSeed: 'senza', useCustomAvatar: false };
    if (!state.playlists) state.playlists = [];
    if (state.queueIndex === undefined) state.queueIndex = 0;
    return state;
  } catch {
    return defaultState();
  }
}

async function saveState(state) {
  const libraryRoot = getLibraryRoot();
  const result = validateSaveState(state, libraryRoot);
  if (!result.ok) {
    console.error('[senza] save-state rejected:', result.reason);
    throw new Error(`Invalid save-state: ${result.reason}`);
  }
  await fs.writeFile(getStatePath(), JSON.stringify(result.state, null, 2), 'utf8');
}

async function scanAudioFiles(dir) {
  const found = [];
  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) {
        found.push(full);
      }
    }
  }
  await walk(dir);
  return found;
}

async function importPaths(paths) {
  const state = await loadState();
  const libraryRoot = await ensureLibrary();
  const existingPaths = new Set(state.tracks.map((t) => path.normalize(t.path).toLowerCase()));
  const added = [];
  const skipped = [];

  for (const filePath of paths) {
    const ext = path.extname(filePath).toLowerCase();
    if (!AUDIO_EXT.has(ext)) continue;

    let meta = {};
    try {
      const parsed = await readTags(filePath);
      meta = {
        title: parsed.title || path.basename(filePath, ext),
        artist: parsed.artist || 'Unknown Artist',
        album: parsed.album || 'Unknown Album',
        genre: parsed.genre || '',
        year: parsed.year || null,
        trackNo: parsed.trackNo || null,
        duration: parsed.duration || 0,
        hasCover: parsed.hasCover || false,
      };
    } catch {
      meta = {
        title: path.basename(filePath, ext),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        genre: '',
        year: null,
        trackNo: null,
        duration: 0,
        hasCover: false,
      };
    }

    meta = normalizeImportMeta(filePath, meta);

    let libraryPath;
    try {
      libraryPath = await resolveLibraryAudioPath(libraryRoot, filePath, meta);
    } catch (err) {
      skipped.push({ filePath, reason: err.message });
      continue;
    }

    const norm = path.normalize(libraryPath).toLowerCase();
    if (existingPaths.has(norm)) {
      skipped.push({ filePath, reason: 'already in library' });
      continue;
    }

    let glyphFeatures = null;
    try {
      glyphFeatures = await extractGlyphFeatures(libraryPath, meta);
    } catch {
      
    }

    const track = {
      id: crypto.randomUUID(),
      path: libraryPath,
      sourcePath: path.normalize(filePath) !== norm ? path.normalize(filePath) : undefined,
      title: meta.title,
      artist: meta.artist || 'Unknown Artist',
      album: meta.album || 'Unknown Album',
      genre: meta.genre || '',
      year: meta.year || null,
      trackNo: meta.trackNo || null,
      duration: meta.duration || 0,
      hasCover: false,
      addedAt: new Date().toISOString(),
      glyph: glyphFeatures,
    };
    const storedCover = await extractAndStoreCover(libraryRoot, track);
    track.hasCover = meta.hasCover || storedCover;
    state.tracks.push(track);
    existingPaths.add(norm);
    added.push(track);
  }

  await saveState(state);
  if (added.length) {
    upsertManyTracks(libraryRoot, added).catch(() => {});
  }
  return { added: added.map((t) => t.id), skipped, total: state.tracks.length };
}

function createWindow() {
  const icon = getAppIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0a0a0a',
    frame: false,
    show: false,
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await ensureLibrary();

  ipcMain.handle('senza:get-state', loadState);
  ipcMain.handle('senza:save-state', (_, state) => saveState(state));
  ipcMain.handle('senza:get-library-root', () => getLibraryRoot());

  ipcMain.handle('senza:glyph-learn-log', async (_, payload) => {
    const libraryRoot = getLibraryRoot();
    const state = await loadState();
    const track = state.tracks.find((t) => t.id === payload.trackId) || {
      id: payload.trackId,
      path: payload.path || '',
    };
    const entry = buildEntryFromTrack(track, libraryRoot, {
      event: payload.event,
      before: payload.before,
      suggested: payload.suggested,
      after: payload.after,
      glyph: payload.glyph,
      accepted: payload.accepted,
      contributorId: payload.contributorId || '',
    });
    await appendLearnEntry(libraryRoot, entry);
    const ev = String(payload.event || '');
    if (ev.includes('apply') || ev === 'tag-save' || ev === 'tag_save') {
      rebuildLearnedPack(libraryRoot).catch(() => {});
    }
    return { ok: true };
  });

  ipcMain.handle('senza:glyph-log', async (_, payload) => {
    const libraryRoot = getLibraryRoot();
    const state = await loadState();
    const track =
      state.tracks.find((t) => t.id === payload.track?.id || t.id === payload.trackId) ||
      payload.track || { id: payload.trackId, path: '' };
    const result = await logGlyphSqlEvent(libraryRoot, { ...payload, track });
    const ev = String(payload.event || '');
    if (
      result.ok &&
      (ev.includes('glyph.apply') || ev === 'glyph.auto' || ev === 'tag-save')
    ) {
      rebuildLearnedPack(libraryRoot).catch(() => {});
    }
    return result;
  });

  ipcMain.handle('senza:glyph-log-stats', async () => {
    const libraryRoot = getLibraryRoot();
    return getGlyphLogStats(libraryRoot);
  });

  ipcMain.handle('senza:glyph-log-export-dataset', async (_, opts = {}) => {
    const libraryRoot = getLibraryRoot();
    return exportGlyphDataset(libraryRoot, opts);
  });

  ipcMain.handle('senza:glyph-analytics', async () => {
    const libraryRoot = getLibraryRoot();
    const state = await loadState();
    return getGlyphAnalytics(libraryRoot, { trackCount: state.tracks?.length ?? 0 });
  });

  ipcMain.handle('senza:glyph-learn-stats', async () => {
    const libraryRoot = getLibraryRoot();
    return getLearnStats(libraryRoot);
  });

  ipcMain.handle('senza:glyph-learn-export', async (_, { contributorId, note } = {}) => {
    const libraryRoot = getLibraryRoot();
    const result = await exportLearnBundle(libraryRoot, { contributorId, note });
    return result;
  });

  ipcMain.handle('senza:glyph-open-exports', async () => {
    const libraryRoot = getLibraryRoot();
    const { exportsDir } = require('./glyph-learn.cjs');
    const dir = exportsDir(libraryRoot);
    await fs.mkdir(dir, { recursive: true });
    await shell.openPath(dir);
    return dir;
  });

  ipcMain.handle('senza:glyph-mi-status', (_, { force } = {}) => getGlyphMiStatus(Boolean(force)));

  ipcMain.handle('senza:glyph-analyze', async (_, input) => glyphAnalyze(input));

  ipcMain.handle('senza:glyph-vault-scan', async (_, { tracks, maxFixPreview } = {}) => {
    const state = tracks?.length ? null : await loadState();
    const list = tracks || state?.tracks || [];
    return glyphVaultScan(list, { maxFixPreview });
  });

  ipcMain.handle('senza:glyph-reload-knowledge', () => glyphReloadKnowledge());

  ipcMain.handle('senza:glyph-musicbrainz-lookup', async (_, query) => {
    const libraryRoot = getLibraryRoot();
    return musicBrainzLookup(libraryRoot, query || {});
  });

  ipcMain.handle('senza:glyph-acoustid-lookup', async (_, payload) => {
    const libraryRoot = getLibraryRoot();
    const state = await loadState();
    const settings = state.settings || {};
    return acoustidLookup(libraryRoot, {
      filePath: payload?.filePath,
      duration: payload?.duration,
      apiKey: payload?.apiKey || settings.acoustidApiKey || process.env.ACOUSTID_API_KEY,
    });
  });

  ipcMain.handle('senza:glyph-online-status', async () => getOnlineStatus());

  ipcMain.handle('senza:glyph-fingerprint', async (_, payload) => {
    const libraryRoot = getLibraryRoot();
    return fingerprintFile(libraryRoot, { filePath: payload?.filePath });
  });

  ipcMain.handle('senza:glyph-download-tools', async () => downloadChromaprintTools());

  ipcMain.handle('senza:glyph-import-export', async () => {
    const libraryRoot = getLibraryRoot();
    return importExportToPrivatePack(libraryRoot);
  });

  ipcMain.handle('senza:glyph-library-features', async () => {
    const libraryRoot = getLibraryRoot();
    return getLibraryFeatureRows(libraryRoot);
  });

  ipcMain.handle('senza:glyph-db-upsert', async (_, { track }) => {
    const libraryRoot = getLibraryRoot();
    return upsertTrackFeatures(libraryRoot, track);
  });

  ipcMain.handle('senza:glyph-db-sync', async (_, { tracks } = {}) => {
    const libraryRoot = getLibraryRoot();
    const state = tracks?.length ? null : await loadState();
    const list = tracks || state?.tracks || [];
    return upsertManyTracks(libraryRoot, list);
  });

  ipcMain.handle('senza:glyph-learned-pack', async () => {
    const libraryRoot = getLibraryRoot();
    return loadLearnedPack(libraryRoot);
  });

  ipcMain.handle('senza:glyph-rebuild-learned', async () => {
    const libraryRoot = getLibraryRoot();
    return rebuildLearnedPack(libraryRoot);
  });

  ipcMain.handle('senza:pick-files', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac'] }],
    });
    if (canceled || !filePaths.length) return { added: [], total: 0 };
    return importPaths(filePaths);
  });

  ipcMain.handle('senza:pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (canceled || !filePaths[0]) return { added: [], total: 0 };
    const files = await scanAudioFiles(filePaths[0]);
    return importPaths(files);
  });

  ipcMain.handle('senza:import-paths', (_, paths) => importPaths(paths));

  ipcMain.handle('senza:open-path', (_, filePath) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('senza:file-url', (_, filePath) => pathToFileURL(filePath).href);

  ipcMain.handle('senza:window-minimize', () => mainWindow?.minimize());
  ipcMain.handle('senza:window-toggle-maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }
    mainWindow.maximize();
    return true;
  });
  ipcMain.handle('senza:window-close', () => mainWindow?.close());

  ipcMain.handle('senza:read-tags', (_, filePath) => readTags(filePath));

  ipcMain.handle('senza:cover-url', async (_, trackId) => {
    const root = await ensureLibrary();
    const p = getCoverPath(root, trackId);
    if (!existsSync(p)) return '';
    return pathToFileURL(p).href;
  });

  ipcMain.handle('senza:write-tags', async (_, { trackId, tags }) => {
    const state = await loadState();
    const libraryRoot = await ensureLibrary();
    const track = state.tracks.find((t) => t.id === trackId);
    if (!track) throw new Error('Track not found');

    const trackPath = path.resolve(track.path);
    if (!isUnderDir(trackPath, libraryRoot)) {
      throw new Error('Track path escapes library root');
    }
    track.path = trackPath;

    const writePayload = { ...tags };
    delete writePayload.path;
    delete writePayload.sourcePath;
    if (writePayload.coverPath) {
      const coverPath = path.resolve(writePayload.coverPath);
      if (!isUnderDir(coverPath, libraryRoot)) {
        throw new Error('Cover path escapes library root');
      }
      writePayload.coverPath = coverPath;
    }
    const writable = canWriteTags(trackPath);

    if (tags.coverBuffer?.length) {
      const buf = Buffer.from(tags.coverBuffer);
      await saveCoverFile(libraryRoot, track.id, buf);
      track.hasCover = true;
      writePayload.coverBuffer = buf;
    }

    let updated;
    if (writable) {
      updated = await writeTags(trackPath, writePayload);
    } else {
      updated = {
        title: tags.title ?? track.title,
        artist: tags.artist ?? track.artist,
        album: tags.album ?? track.album,
        genre: tags.genre ?? track.genre,
        year: tags.year ?? track.year,
        trackNo: tags.trackNo ?? track.trackNo,
        hasCover: track.hasCover,
      };
    }
    Object.assign(track, {
      title: updated.title || track.title,
      artist: updated.artist || track.artist,
      album: updated.album || track.album,
      genre: updated.genre || track.genre,
      year: updated.year || track.year,
      trackNo: updated.trackNo || track.trackNo,
      hasCover: track.hasCover || updated.hasCover || (await coverExists(libraryRoot, track.id)),
    });
    await saveState(state);
    upsertTrackFeatures(libraryRoot, track).catch(() => {});
    return track;
  });

  ipcMain.handle('senza:library-export', async () => {
    const userData = app.getPath('userData');
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'senza-library.zip',
      filters: [{ name: 'Senza Library', extensions: ['zip'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    return exportLibrary(userData, filePath);
  });

  ipcMain.handle('senza:library-import', async (_, { merge } = {}) => {
    const userData = app.getPath('userData');
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Senza Library', extensions: ['zip'] }],
    });
    if (canceled || !filePaths[0]) return { ok: false, canceled: true };
    const result = await importLibrary(userData, filePaths[0], { merge: Boolean(merge) });
    if (!merge && result.importedState) {
      await saveState(result.importedState);
    }
    return result;
  });

  ipcMain.handle('senza:watched-folder-start', async (_, folderPath) => {
    return await startWatch(folderPath, async (paths) => {
      const result = await importPaths(paths);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('senza:watched-import', result);
      }
    });
  });

  ipcMain.handle('senza:watched-folder-stop', () => {
    stopWatch();
    return { ok: true };
  });

  ipcMain.handle('senza:pick-watched-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (canceled || !filePaths[0]) return null;
    return filePaths[0];
  });

  ipcMain.handle('senza:lyrics-for-track', async (_, { filePath }) => {
    return findLyricsForTrack(filePath);
  });

  ipcMain.handle('senza:onnx-status', () => onnxStatus());

  ipcMain.handle('senza:pick-cover', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return null;
    return { coverPath: filePaths[0] };
  });

  ipcMain.handle('senza:library-tree', async () => {
    const root = await ensureLibrary();
    return getLibraryTree(root);
  });

  ipcMain.handle('senza:profile-get', async () => {
    const state = await loadState();
    return state.profile || { displayName: 'senza-listener', avatarSeed: 'senza', useCustomAvatar: false };
  });

  ipcMain.handle('senza:profile-save', async (_, profile) => {
    const state = await loadState();
    state.profile = {
      displayName: String(profile.displayName || 'senza-listener').slice(0, 32),
      avatarSeed: profile.avatarSeed || 'senza',
      useCustomAvatar: Boolean(profile.useCustomAvatar),
    };
    const root = await ensureLibrary();
    if (profile.avatarBuffer?.length) {
      const buf = Buffer.from(profile.avatarBuffer);
      await fs.writeFile(path.join(root, 'profile-avatar.jpg'), buf);
      state.profile.useCustomAvatar = true;
    }
    await saveState(state);
    return state.profile;
  });

  ipcMain.handle('senza:read-file-binary', async (_, filePath) => {
    if (!filePath || !existsSync(filePath)) return null;
    const buf = await fs.readFile(filePath);
    return Array.from(buf);
  });

  ipcMain.handle('senza:artist-avatar-url', async (_, slug) => {
    const root = await ensureLibrary();
    return artistAvatarUrl(root, slug);
  });

  ipcMain.handle('senza:artist-avatar-save', async (_, { slug, buffer }) => {
    const root = await ensureLibrary();
    if (!slug || !buffer?.length) throw new Error('Invalid artist avatar');
    await saveArtistAvatar(root, slug, Buffer.from(buffer));
    return { ok: true };
  });

  ipcMain.handle('senza:confirm-bulk-remove', async (_, { count, locale }) => {
    const ru = locale === 'ru';
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: ru ? 'Удалить треки' : 'Remove tracks',
      message: ru ? `Удалить ${count} треков из Senza?` : `Remove ${count} tracks from Senza?`,
      detail: ru
        ? '«Только из списка» — файлы останутся. «Удалить файлы» — удалит аудио из папки библиотеки.'
        : '“Remove from list” keeps files on disk. “Delete files” removes audio from your library folder.',
      buttons: ru
        ? ['Отмена', 'Только из списка', 'Удалить файлы']
        : ['Cancel', 'Remove from list', 'Delete files'],
      defaultId: 0,
      cancelId: 0,
    });
    if (response === 0) return null;
    return { deleteFile: response === 2 };
  });

  ipcMain.handle('senza:confirm-remove-track', async (_, { locale }) => {
    const ru = locale === 'ru';
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: ru ? 'Удалить трек' : 'Remove track',
      message: ru ? 'Убрать трек из Senza?' : 'Remove this track from Senza?',
      detail: ru
        ? '«Только из списка» — файл останется на диске. «Удалить файл» — удалит аудио из папки библиотеки.'
        : '“Remove from list” keeps the file on disk. “Delete file” removes the audio from your library folder.',
      buttons: ru
        ? ['Отмена', 'Только из списка', 'Удалить файл']
        : ['Cancel', 'Remove from list', 'Delete file'],
      defaultId: 0,
      cancelId: 0,
    });
    if (response === 0) return null;
    return { deleteFile: response === 2 };
  });

  ipcMain.handle('senza:remove-track', async (_, { trackId, deleteFile }) => {
    const state = await loadState();
    const root = await ensureLibrary();
    const idx = state.tracks.findIndex((t) => t.id === trackId);
    if (idx < 0) throw new Error('Track not found');
    const track = state.tracks[idx];

    for (const pl of state.playlists) {
      if (pl.trackIds?.includes(trackId)) {
        pl.trackIds = pl.trackIds.filter((id) => id !== trackId);
        await savePlaylist(root, pl);
      }
    }

    state.tracks.splice(idx, 1);
    state.queue = (state.queue || []).filter((id) => id !== trackId);
    if (state.queueIndex >= state.queue.length) {
      state.queueIndex = Math.max(0, state.queue.length - 1);
    }
    state.playHistory = (state.playHistory || []).filter((e) => e.trackId !== trackId);

    const coverPath = getCoverPath(root, trackId);
    if (existsSync(coverPath)) {
      await fs.unlink(coverPath).catch(() => {});
    }

    if (deleteFile && track.path) {
      const candidate = path.resolve(track.path);
      if (!isUnderDir(candidate, root)) {
        console.error('[senza] refuse to delete path outside library:', track.path);
      } else if (existsSync(candidate)) {
        await fs.unlink(candidate).catch(() => {});
      }
    }

    await saveState(state);
    return { ok: true };
  });

  ipcMain.handle('senza:profile-avatar-url', async () => {
    const state = await loadState();
    const root = await ensureLibrary();
    const custom = path.join(root, 'profile-avatar.jpg');
    if (state.profile?.useCustomAvatar && fsSync.existsSync(custom)) {
      return pathToFileURL(custom).href;
    }
    return '';
  });

  ipcMain.handle('senza:playlists-list', async () => {
    const root = await ensureLibrary();
    return listPlaylists(root);
  });

  ipcMain.handle('senza:playlist-create', async (_, name) => {
    const root = await ensureLibrary();
    return createPlaylist(root, name);
  });

  ipcMain.handle('senza:playlist-save', async (_, playlist) => {
    const root = await ensureLibrary();
    await savePlaylist(root, playlist);
    const state = await loadState();
    const idx = state.playlists.findIndex((p) => p.id === playlist.id);
    if (idx >= 0) state.playlists[idx] = playlist;
    else state.playlists.push(playlist);
    await saveState(state);
    return playlist;
  });

  ipcMain.handle('senza:playlist-delete', async (_, slug) => {
    const root = await ensureLibrary();
    await deletePlaylist(root, slug);
    const state = await loadState();
    state.playlists = state.playlists.filter((p) => p.slug !== slug);
    await saveState(state);
    return true;
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

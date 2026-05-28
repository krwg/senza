const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const { existsSync } = require('fs');
const { pathToFileURL } = require('url');
const crypto = require('crypto');
const fs = require('fs/promises');
const { readTags, writeTags } = require('./tags.cjs');
const { resolveLibraryAudioPath } = require('./import.cjs');
const { saveCoverFile, coverExists, extractAndStoreCover, getCoverPath } = require('./covers.cjs');
const { getLibraryTree } = require('./library-tree.cjs');
const fsSync = require('fs');
const {
  listPlaylists,
  createPlaylist,
  savePlaylist,
  deletePlaylist,
} = require('./playlists.cjs');

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
  return root;
}

async function loadState() {
  try {
    const raw = await fs.readFile(getStatePath(), 'utf8');
    const state = JSON.parse(raw);
    if (!state.settings) state.settings = { theme: 'dark', locale: 'en', collectionMode: false, volume: 0.85, clickLock: false };
    if (!state.profile) state.profile = { displayName: 'senza-listener', avatarSeed: 'senza', useCustomAvatar: false };
    if (!state.playlists) state.playlists = [];
    if (state.queueIndex === undefined) state.queueIndex = 0;
    return state;
  } catch {
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
}

async function saveState(state) {
  await fs.writeFile(getStatePath(), JSON.stringify(state, null, 2), 'utf8');
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
    };
    const storedCover = await extractAndStoreCover(libraryRoot, track);
    track.hasCover = meta.hasCover || storedCover;
    state.tracks.push(track);
    existingPaths.add(norm);
    added.push(track);
  }

  await saveState(state);
  return { added, skipped, total: state.tracks.length };
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

    const writePayload = { ...tags };
    const isMp3 = path.extname(track.path).toLowerCase() === '.mp3';

    if (tags.coverBuffer?.length) {
      const buf = Buffer.from(tags.coverBuffer);
      await saveCoverFile(libraryRoot, track.id, buf);
      track.hasCover = true;
      if (isMp3) writePayload.coverBuffer = buf;
    }

    let updated = track;
    if (isMp3) {
      updated = await writeTags(track.path, writePayload);
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
    return track;
  });

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

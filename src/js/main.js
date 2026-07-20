import { detectLocale, applyI18n, t, tf } from './i18n.js';
import { randomDisplayName, randomProfileSeed, drawIdenticon, identiconToDataUrl } from './profile.js';
import { filterTracks, sortAlbumTracks, trackIncludesArtist } from './library.js';
import { fuzzyFilterTracks } from './search.js';
import { initHotkeys } from './hotkeys.js';
import { effectiveVolume } from './replaygain.js';
import { evaluateSmartPlaylist, defaultSmartPlaylists } from './smart-playlists.js';
import { NAV_CATALOG, normalizeNavConfig, navItemsForZone, defaultNavConfig } from './nav-config.js';
import { applyArtworkElement, applyArtistPortrait } from './cover-art.js';
import { showToast } from './toast.js';
import { confirmRemoveTrack, confirmBulkRemove, initDialog } from './dialog.js';
import { createPlayer } from './player.js';
import { initPlayerChrome } from './player-chrome.js';
import {
  runGlyphAnalysis,
  renderGlyphPanel,
  renderGlyphLoading,
  rescoreGlyphFromForm,
  GLYPH_VERSION,
} from './glyph-ui.js';
import { scanVaultLibrary } from './glyph-scan.js';
import { GLYPH_PUBLIC_PACKS } from './glyph-knowledge-packs.js';
import { duplicateSummaryForTracks } from './glyph-duplicates.js';
import { autoTagTracks } from './glyph-auto-tag.js';
import {
  pickTags,
  pickTagsFromForm,
  tagsMatch,
  glyphMetaFromAnalysis,
  logGlyphEvent,
} from './glyph-learn.js';
import { logGlyphSuggest, logGlyphReject } from './glyph-telemetry.js';
import { scanBatchCandidates, applyBatchResults } from './glyph-batch.js';
import { openCoverCropModal } from './cover-crop.js';
import { formatArtistsDisplay, splitArtists } from './artists.js';
import { logPlay } from './journal.js';
import { isGlyphEnabled } from './glyph-settings.js';
import { setIcon } from './icons.js';
import {
  renderTracksView,
  renderAlbumsView,
  renderAlbumDetailView,
  renderCollectionView,
  renderArtistsView,
  renderPlaylistsView,
  renderVaultView,
  renderImportView,
  renderJournalView,
  renderSettingsView,
  renderArtistDetailView,
  renderTrackRow,
  renderLibraryTreeHtml,
  renderRecentView,
  renderFavoritesView,
} from './views.js';
import { renderFlowView } from './views-flow.js';
import { buildFlowWave, FLOW_MODES } from './flow.js';
import {
  refreshFlowVisuals,
  startFlowBeatSync,
  stopFlowBeatSync,
} from './flow-ambient.js';
import { trackWithInferredAlbum, tracksMissingAlbum } from './glyph-album.js';
import { bindHints } from './hint.js';

const api = window.senza;

let state = {
  tracks: [],
  queue: [],
  queueIndex: 0,
  playlists: [],
  playHistory: [],
  favoriteIds: [],
  smartPlaylists: [],
  settings: {
    theme: 'dark',
    locale: 'en',
    collectionMode: false,
    volume: 0.85,
    clickLock: false,
    accentColor: '#c8a96e',
    crossfadeSec: 0,
    replayGainEnabled: false,
    lyricsEnabled: true,
    fuzzySearch: true,
    watchedFolder: '',
    glyphTryLocal: false,
    glyphUseMI: true,
    glyphUseMusicBrainz: true,
    glyphAutoOnImport: true,
    glyphAutoApplyOnImport: true,
    glyphUseAcoustid: true,
    glyphLearnEnabled: true,
    glyphLogEnabled: true,
    glyphContributorId: '',
    sortTracks: { key: 'title', dir: 'asc' },
    sortAlbums: { key: 'album', dir: 'asc' },
    sortArtists: { key: 'name', dir: 'asc' },
  },
};
let locale = detectLocale();
let currentView = 'flow';
let flowMode = 'blend';
let flowWave = [];
let flowGenerating = false;
const flowSessionPlayed = new Set();
let settingsSection = 'appearance';
let albumFocus = null;
let artistFocus = null;
let lastLoggedTrackId = null;
let playlistPickerTrackId = null;
let contextMenuTrackId = null;
let searchQuery = '';
let vaultDetailFilter = null;
let vaultGlyphScan = null;
let vaultGlyphLoading = false;
let bulkSelectMode = false;
const selectedTrackIds = new Set();
let editingTrackId = null;
let pendingCover = null;
let pendingProfileAvatar = null;
let lastGlyphFields = null;
let lastGlyphAnalysis = null;
let tagEditSession = null;
let libraryRoot = '';
let lastUsageTick = Date.now();

function tickUsageMs() {
  if (!state.usage) state.usage = { totalMs: 0 };
  const now = Date.now();
  const delta = now - lastUsageTick;
  lastUsageTick = now;
  if (document.hidden) return;
  if (delta > 0 && delta < 120000) state.usage.totalMs += delta;
}

function applyTagEditorGlyphUi() {
  const enabled = isGlyphEnabled(state.settings);
  const slot = document.getElementById('glyphPanel');
  const runBtn = document.getElementById('tagGlyphRun');
  tagEditor?.classList.toggle('tag-editor--no-glyph', !enabled);
  slot?.classList.toggle('hidden', !enabled);
  runBtn?.classList.toggle('hidden', !enabled);
  if (!enabled && slot) slot.innerHTML = '';
}

const content = document.getElementById('content');
const sidebarNav = document.getElementById('sidebarNav');
const audio = document.getElementById('audio');
const queuePanel = document.getElementById('queuePanel');
const queueList = document.getElementById('queueList');
const tagEditor = document.getElementById('tagEditor');

let playerChrome;

let lastLyricsLines = [];
let lyricsOpen = false;

function favoriteSet() {
  return new Set(state.favoriteIds || []);
}

function toggleFavorite(trackId) {
  const set = favoriteSet();
  if (set.has(trackId)) set.delete(trackId);
  else set.add(trackId);
  state.favoriteIds = [...set];
  saveState();
  if (['favorites', 'tracks', 'recent'].includes(currentView)) setView(currentView);
  showToast(set.has(trackId) ? t('favorites.added', locale) : t('favorites.removed', locale), 'info', 2000);
}

function applyAccentColor(color) {
  const c = color || state.settings.accentColor || '#c8a96e';
  document.documentElement.style.setProperty('--floke-accent', c);
  document.documentElement.style.setProperty('--accent-dynamic', c);
  document.documentElement.style.setProperty('--floke-accent-muted', `${c}40`);
}

async function refreshLyricsForTrack(track) {
  if (!track?.path || !state.settings.lyricsEnabled) {
    lastLyricsLines = [];
    return;
  }
  try {
    const res = await api.lyricsForTrack?.({ filePath: track.path });
    lastLyricsLines = res?.lines || [];
  } catch {
    lastLyricsLines = [];
  }
}

function updateLyricsDisplay(currentSec) {
  const el = document.getElementById('playerLyrics');
  if (!el || !lyricsOpen || !lastLyricsLines.length) return;
  let best = '';
  for (const line of lastLyricsLines) {
    if (line.time <= currentSec + 0.05) best = line.text;
    else break;
  }
  el.textContent = best || '…';
}

function getRecentTracks() {
  const ordered = [];
  const seen = new Set();
  for (let i = (state.playHistory?.length || 0) - 1; i >= 0; i -= 1) {
    const e = state.playHistory[i];
    if (seen.has(e.trackId)) continue;
    const tr = state.tracks.find((t) => t.id === e.trackId);
    if (!tr) continue;
    seen.add(e.trackId);
    ordered.push(tr);
    if (ordered.length >= 50) break;
  }
  return ordered;
}

let player;

function playerBaseVolume() {
  const base = state.settings?.volume ?? 0.85;
  if (!player) return base;
  const q = player.getQueue();
  const tr = q[player.getIndex()];
  if (tr && state.settings?.replayGainEnabled) {
    return effectiveVolume(base, tr, state.settings);
  }
  return base;
}

player = createPlayer(
  audio,
  (status) => {
    if (status.track?.id && status.playing && status.track.id !== lastLoggedTrackId) {
      logPlay(state, status.track);
      lastLoggedTrackId = status.track.id;
      void refreshLyricsForTrack(status.track);
    }
    if (!status.playing && !status.track) lastLoggedTrackId = null;
    if (status.track && status.playing && state.settings.replayGainEnabled) {
      audio.volume = effectiveVolume(state.settings.volume ?? 0.85, status.track, state.settings);
    }
    playerChrome?.onPlaybackUpdate(status.track, status.playing);
    renderQueue(status.queue, status.index);
    persistPlayback(status.queue, status.index);
    if (state.settings.shuffleOn !== status.shuffleOn) {
      state.settings.shuffleOn = status.shuffleOn;
      saveState();
    }
    if (state.settings.repeatMode !== status.repeatMode) {
      state.settings.repeatMode = status.repeatMode;
      saveState();
    }
    if (currentView === 'flow') {
      const root = content.querySelector('.flow-view');
      refreshFlowVisuals(root, status.track, status.playing, api);
      if (status.playing && status.track) startFlowBeatSync(root, audio, status.track);
      else stopFlowBeatSync();
    }
  },
  (p) => api.fileUrl(p),
  {
    crossfadeSec: state.settings?.crossfadeSec ?? 0,
    getVolume: () => playerBaseVolume(),
    baseVolume: state.settings?.volume ?? 0.85,
  }
);

function persistPlayback(queue, index) {
  state.queue = queue.map((t) => t.id);
  state.queueIndex = index;
  api.saveState(state);
}

async function afterImport(result) {
  await loadState();
  const parts = [];
  const addedIds = result?.added || [];
  if (addedIds.length) {
    parts.push(t('import.done', locale).replace('{n}', String(addedIds.length)));
  }
  if (result?.skipped?.length) {
    parts.push(t('import.skipped', locale).replace('{n}', String(result.skipped.length)));
  }
  if (parts.length) showToast(parts.join(' · '), 'success');

  if (addedIds.length && isGlyphEnabled(state.settings) && state.settings?.glyphAutoApplyOnImport !== false) {
    const imported = state.tracks.filter((tr) => addedIds.includes(tr.id));
    showToast(t('glyph.autoTagging', locale), 'info', 4000);
    const { applied, checked, fieldsWritten } = await autoTagTracks(imported, state, locale, api, {
      minScore: 32,
      maxTracks: 200,
      onlyWeak: false,
      aggressive: true,
    });
    if (api.glyphDbSync) {
      await loadState();
      api.glyphDbSync(state.tracks).catch(() => {});
    }
    await loadState();
    if (applied > 0) {
      showToast(tf('glyph.autoTagged', locale, { n: applied, total: checked, fields: fieldsWritten }), 'success', 8000);
    } else {
      showToast(t('glyph.autoTaggedNone', locale), 'info', 5000);
    }
  }

  setView('flow');
}

async function addTrackToPlaylist(slug, trackId) {
  const pl = state.playlists.find((p) => p.slug === slug);
  if (!pl || pl.trackIds.includes(trackId)) return;
  pl.trackIds.push(trackId);
  await api.playlistSave(pl);
  const idx = state.playlists.findIndex((p) => p.slug === slug);
  if (idx >= 0) state.playlists[idx] = pl;
}

function openPlaylistPicker(trackId) {
  playlistPickerTrackId = trackId;
  const list = document.getElementById('playlistPickerList');
  const empty = document.getElementById('playlistPickerEmpty');
  const picker = document.getElementById('playlistPicker');
  if (!list || !picker) return;

  if (!state.playlists.length) {
    list.innerHTML = '';
    empty.textContent = locale === 'ru' ? 'Создайте плейлист в разделе Playlists' : 'Create a playlist first in Playlists';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    list.innerHTML = state.playlists
      .map(
        (p) => `
      <li><button type="button" class="playlist-picker-item" data-pick-playlist="${p.slug}">
        <strong>${p.name}</strong>
        <span>${p.trackIds?.length || 0}</span>
      </button></li>`
      )
      .join('');
    list.querySelectorAll('[data-pick-playlist]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await addTrackToPlaylist(btn.dataset.pickPlaylist, playlistPickerTrackId);
        picker.classList.add('hidden');
        showToast(t('playlists.added', locale), 'success');
        if (currentView === 'playlists') setView('playlists');
      });
    });
  }
  picker.classList.remove('hidden');
  applyI18n(locale);
}

function openAlbumFocus(artist, album) {
  artistFocus = null;
  albumFocus = { artist, album };
  setView('album');
}

function openArtistFocus(id, name) {
  albumFocus = null;
  artistFocus = { id, name };
  setView('artist');
}

function syncPlayerQueueFromState() {
  const qTracks = (state.queue || [])
    .map((id) => state.tracks.find((tr) => tr.id === id))
    .filter(Boolean);
  const idx = Math.min(state.queueIndex || 0, Math.max(0, qTracks.length - 1));
  player.setQueue(qTracks, qTracks.length ? idx : 0);
}

function ensureSortSettings() {
  if (!state.settings.sortTracks) state.settings.sortTracks = { key: 'title', dir: 'asc' };
  if (!state.settings.sortAlbums) state.settings.sortAlbums = { key: 'album', dir: 'asc' };
  if (!state.settings.sortArtists) state.settings.sortArtists = { key: 'name', dir: 'asc' };
  if (state.settings.glyphTryLocal === undefined) state.settings.glyphTryLocal = false;
  if (state.settings.glyphLearnEnabled === undefined) state.settings.glyphLearnEnabled = true;
  if (state.settings.glyphLogEnabled === undefined) state.settings.glyphLogEnabled = true;
  if (state.settings.glyphContributorId === undefined) state.settings.glyphContributorId = '';
  if (state.settings.glyphUseMI === undefined) state.settings.glyphUseMI = true;
  if (state.settings.glyphUseMusicBrainz === undefined) state.settings.glyphUseMusicBrainz = true;
  if (state.settings.glyphAutoOnImport === undefined) state.settings.glyphAutoOnImport = true;
  if (state.settings.glyphAutoApplyOnImport === undefined) state.settings.glyphAutoApplyOnImport = true;
  if (state.settings.glyphUseAcoustid === undefined) state.settings.glyphUseAcoustid = true;
  if (!FLOW_MODES.includes(state.settings.flowMode)) state.settings.flowMode = 'blend';
  flowMode = state.settings.flowMode;
}

function bindSortBar(prefix, storageKey) {
  const keyEl = document.getElementById(`${prefix}Key`);
  const dirBtn = document.getElementById(`${prefix}Dir`);
  if (!keyEl || !dirBtn) return;

  keyEl.addEventListener('change', async () => {
    state.settings[storageKey] = state.settings[storageKey] || {};
    state.settings[storageKey].key = keyEl.value;
    await saveState();
    setView(currentView);
  });

  dirBtn.addEventListener('click', async () => {
    const cur = state.settings[storageKey] || { key: keyEl.value, dir: 'asc' };
    cur.dir = cur.dir === 'desc' ? 'asc' : 'desc';
    state.settings[storageKey] = cur;
    await saveState();
    setView(currentView);
  });
}

async function removeTrackById(trackId) {
  const choice = await confirmRemoveTrack(locale);
  if (!choice) return false;
  await api.removeTrack({ trackId, deleteFile: Boolean(choice.deleteFile) });
  await loadState();
  syncPlayerQueueFromState();
  showToast(t('bulk.removed', locale), 'success');
  return true;
}

function updateBulkToolbarState() {
  const countEl = document.getElementById('bulkCount');
  const editBtn = document.getElementById('btnBulkEdit');
  const delBtn = document.getElementById('btnBulkDelete');
  if (countEl) countEl.textContent = tf('bulk.selected', locale, { n: selectedTrackIds.size });
  const on = selectedTrackIds.size > 0;
  if (editBtn) editBtn.disabled = !on;
  if (delBtn) delBtn.disabled = !on;
  content.querySelectorAll('.track-row').forEach((row) => {
    const id = row.dataset.id;
    row.classList.toggle('track-row--selected', selectedTrackIds.has(id));
    const cb = row.querySelector('[data-select-track]');
    if (cb) cb.checked = selectedTrackIds.has(id);
  });
}

function bindBulkToolbar() {
  document.getElementById('btnBulkToggle')?.addEventListener('click', () => {
    bulkSelectMode = !bulkSelectMode;
    if (!bulkSelectMode) selectedTrackIds.clear();
    setView('tracks');
  });
  document.getElementById('btnBulkEdit')?.addEventListener('click', () => openBulkEditor());
  document.getElementById('btnBulkDelete')?.addEventListener('click', () => bulkDeleteSelected());
}

function bindTrackSelectCheckboxes() {
  content.querySelectorAll('[data-select-track]').forEach((cb) => {
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', () => {
      const id = cb.dataset.selectTrack;
      if (cb.checked) selectedTrackIds.add(id);
      else selectedTrackIds.delete(id);
      updateBulkToolbarState();
    });
  });
}

function openBulkEditor() {
  if (!selectedTrackIds.size) {
    showToast(t('bulk.noneSelected', locale), 'error');
    return;
  }
  const panel = document.getElementById('bulkEditor');
  document.getElementById('bulkEditorSub').textContent = tf('bulk.selected', locale, {
    n: selectedTrackIds.size,
  });
  ['bulkArtist', 'bulkAlbum', 'bulkGenre', 'bulkYear'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  panel?.classList.remove('hidden');
  setIcon('bulkEditorClose', 'close');
}

function closeBulkEditor() {
  document.getElementById('bulkEditor')?.classList.add('hidden');
}

async function bulkDeleteSelected() {
  if (!selectedTrackIds.size) {
    showToast(t('bulk.noneSelected', locale), 'error');
    return;
  }
  const ids = [...selectedTrackIds];
  const choice = await confirmBulkRemove(ids.length, locale);
  if (!choice) return;
  for (const id of ids) {
    await api.removeTrack({ trackId: id, deleteFile: Boolean(choice.deleteFile) });
  }
  selectedTrackIds.clear();
  bulkSelectMode = false;
  await loadState();
  syncPlayerQueueFromState();
  showToast(tf('bulk.deleted', locale, { n: ids.length }), 'success');
  setView('tracks');
}

async function applyBulkEditor(e) {
  e.preventDefault();
  const ids = [...selectedTrackIds];
  if (!ids.length) return;
  const patch = {};
  const artist = document.getElementById('bulkArtist')?.value?.trim();
  const album = document.getElementById('bulkAlbum')?.value?.trim();
  const genre = document.getElementById('bulkGenre')?.value?.trim();
  const year = document.getElementById('bulkYear')?.value?.trim();
  if (artist) patch.artist = artist;
  if (album) patch.album = album;
  if (genre) patch.genre = genre;
  if (year) patch.year = year;
  if (!Object.keys(patch).length) {
    closeBulkEditor();
    return;
  }
  let updated = 0;
  for (const trackId of ids) {
    try {
      const result = await api.writeTags({ trackId, tags: patch });
      const idx = state.tracks.findIndex((tr) => tr.id === trackId);
      if (idx >= 0) state.tracks[idx] = { ...state.tracks[idx], ...result };
      updated += 1;
    } catch (err) {
      console.warn('bulk tag write failed', trackId, err);
    }
  }
  await saveState();
  closeBulkEditor();
  showToast(tf('bulk.updated', locale, { n: updated }), 'success');
  setView(currentView);
}

async function loadState() {
  state = await api.getState();
  if (!state.tracks) state.tracks = [];
  if (!state.queue) state.queue = [];
  if (state.queueIndex === undefined) state.queueIndex = 0;
  if (!state.settings) {
    state.settings = {
      theme: 'dark',
      collectionMode: false,
      volume: 0.85,
      clickLock: false,
      glyphTryLocal: false,
    glyphUseMI: true,
    glyphUseMusicBrainz: true,
    glyphAutoOnImport: true,
    glyphAutoApplyOnImport: true,
    glyphUseAcoustid: true,
    glyphLearnEnabled: true,
    glyphLogEnabled: true,
    glyphContributorId: '',
      sortTracks: { key: 'title', dir: 'asc' },
      sortAlbums: { key: 'album', dir: 'asc' },
      sortArtists: { key: 'name', dir: 'asc' },
    };
  }
  ensureSortSettings();
  if (state.settings.clickLock === undefined) state.settings.clickLock = false;
  if (!state.playHistory) state.playHistory = [];
  if (!state.favoriteIds) state.favoriteIds = [];
  if (!state.smartPlaylists?.length) state.smartPlaylists = defaultSmartPlaylists(state.settings?.locale || locale);
  if (!state.settings.navConfig) state.settings.navConfig = defaultNavConfig();
  state.settings.navConfig = normalizeNavConfig(state.settings.navConfig);
  if (state.settings.accentColor === undefined) state.settings.accentColor = '#c8a96e';
  if (state.settings.crossfadeSec === undefined) state.settings.crossfadeSec = 0;
  if (state.settings.replayGainEnabled === undefined) state.settings.replayGainEnabled = false;
  if (state.settings.lyricsEnabled === undefined) state.settings.lyricsEnabled = true;
  if (state.settings.fuzzySearch === undefined) state.settings.fuzzySearch = true;
  if (state.settings.watchedFolder === undefined) state.settings.watchedFolder = '';
  if (state.settings.shuffleOn) player.setShuffle?.(true);
  if (state.settings.repeatMode) player.setRepeat?.(state.settings.repeatMode);
  player.setCrossfadeSec?.(state.settings.crossfadeSec ?? 0);
  applyAccentColor(state.settings.accentColor);
  if (!state.usage) state.usage = { totalMs: 0 };
  lastUsageTick = Date.now();
  if (!state.profile) {
    const seed = randomProfileSeed();
    state.profile = {
      displayName: randomDisplayName(seed),
      avatarSeed: seed,
      useCustomAvatar: false,
    };
    await api.saveState(state);
  }
  locale = state.settings.locale || localStorage.getItem('senza-lang') || detectLocale();
  localStorage.setItem('senza-lang', locale);
  document.documentElement.setAttribute('data-theme', state.settings.theme || 'dark');
  audio.volume = state.settings.volume ?? 0.85;
  document.getElementById('volume').value = audio.volume;
  libraryRoot = await api.getLibraryRoot();
  const diskPlaylists = await api.playlistsList();
  if (diskPlaylists.length) state.playlists = diskPlaylists;
  if (currentView === 'settings' && settingsSection === 'glyph') {
    refreshGlyphLibraryStats();
  }
}

async function saveState() {
  tickUsageMs();
  state.settings.locale = locale;
  await api.saveState(state);
}

function buildSidebar() {
  if (!state.settings.navConfig) state.settings.navConfig = defaultNavConfig();
  state.settings.navConfig = normalizeNavConfig(state.settings.navConfig);

  const mainItems = navItemsForZone(state.settings.navConfig, 'main');
  sidebarNav.innerHTML = mainItems
    .map(
      (item) => `
    <button type="button" class="nav-item${currentView === item.id ? ' active' : ''}" data-view="${item.id}">
      <span class="nav-icon icon-host" data-icon="${item.icon}"></span>
      <span data-i18n="${item.key}">${t(item.key, locale)}</span>
    </button>`
    )
    .join('');
  sidebarNav.querySelectorAll('[data-icon]').forEach((el) => setIcon(el, el.dataset.icon));

  const footerItems = navItemsForZone(state.settings.navConfig, 'footer');
  const footer = document.querySelector('.sidebar-footer');
  if (footer) {
    footer.innerHTML = footerItems
      .map(
        (item) => `
      <button type="button" class="nav-item${currentView === item.id ? ' active' : ''}" data-view="${item.id}">
        <span class="nav-icon icon-host" data-icon="${item.icon}"></span>
        <span data-i18n="${item.key}">${t(item.key, locale)}</span>
      </button>`
      )
      .join('');
    footer.querySelectorAll('[data-icon]').forEach((el) => setIcon(el, el.dataset.icon));
  }
}

function getFilteredTracks() {
  if (state.settings.fuzzySearch !== false) {
    return fuzzyFilterTracks(state.tracks, searchQuery, { splitArtists });
  }
  return filterTracks(state.tracks, searchQuery, { fuzzy: false });
}

function playById(id, queueTracks = null) {
  const track = state.tracks.find((tr) => tr.id === id);
  if (!track) return;
  const tracks = queueTracks || getFilteredTracks();
  const idx = tracks.findIndex((tr) => tr.id === id);
  if (idx >= 0) {
    player.playTrack(tracks[idx], tracks, idx);
    return;
  }
  player.playTrack(track, [track], 0);
}

async function saveTagsFromEditor() {
  if (!editingTrackId) return false;
  const track = state.tracks.find((tr) => tr.id === editingTrackId);
  if (!track) return false;
  const tags = pickTagsFromForm();
  try {
    await api.writeTags({ trackId: editingTrackId, tags: { ...track, ...tags } });
    await loadState();
    const updated = state.tracks.find((tr) => tr.id === editingTrackId);
    if (updated) {
      document.getElementById('tagTitle').value = updated.title || '';
      document.getElementById('tagArtist').value = updated.artist || '';
      document.getElementById('tagAlbum').value = updated.album || '';
      document.getElementById('tagGenre').value = updated.genre || '';
      document.getElementById('tagYear').value = updated.year || '';
      document.getElementById('tagTrackNo').value = updated.trackNo || '';
    }
    showToast(t('tags.saved', locale), 'success');
    return true;
  } catch (err) {
    showToast(err.message || String(err), 'error');
    return false;
  }
}

function applyGlyphToForm(fields, { log, save } = {}) {
  if (!fields) return;
  if (fields.title !== undefined) document.getElementById('tagTitle').value = fields.title || '';
  if (fields.artist !== undefined) document.getElementById('tagArtist').value = fields.artist || '';
  if (fields.album !== undefined) document.getElementById('tagAlbum').value = fields.album || '';
  if (fields.genre !== undefined) document.getElementById('tagGenre').value = fields.genre || '';
  if (fields.year !== undefined) document.getElementById('tagYear').value = fields.year || '';
  if (fields.trackNo !== undefined) document.getElementById('tagTrackNo').value = fields.trackNo || '';

  if (save) void saveTagsFromEditor();

  if (log && editingTrackId) {
    const track = state.tracks.find((tr) => tr.id === editingTrackId);
    const suggested = pickTags(lastGlyphFields);
    const after = pickTagsFromForm();
    const before = tagEditSession?.before ?? pickTags(track);
    const accepted = tagsMatch(suggested, after);
    const edited = !tagsMatch(suggested, fields) || !tagsMatch(suggested, after);
    logGlyphEvent(api, state.settings, editingTrackId, 'glyph_apply', {
      before,
      suggested,
      after,
      glyph: glyphMetaFromAnalysis(lastGlyphAnalysis),
      accepted,
      edited,
      track,
    });
  }
}

let glyphFormDebounce = null;

function bindGlyphEditorLive(panel) {
  const ids = ['tagTitle', 'tagArtist', 'tagAlbum', 'tagGenre', 'tagYear', 'tagTrackNo'];
  for (const id of ids) {
    const el = document.getElementById(id);
    el?.addEventListener('input', () => {
      clearTimeout(glyphFormDebounce);
      glyphFormDebounce = setTimeout(() => {
        if (!lastGlyphAnalysis?.result || !editingTrackId) return;
        const track = state.tracks.find((tr) => tr.id === editingTrackId);
        if (!track) return;
        const draft = {
          ...lastGlyphAnalysis.result.fields,
          title: document.getElementById('tagTitle')?.value || '',
          artist: document.getElementById('tagArtist')?.value || '',
          album: document.getElementById('tagAlbum')?.value || '',
          genre: document.getElementById('tagGenre')?.value || '',
          year: document.getElementById('tagYear')?.value || '',
          trackNo: document.getElementById('tagTrackNo')?.value || '',
        };
        const rescored = rescoreGlyphFromForm(track, draft, lastGlyphAnalysis, locale);
        lastGlyphAnalysis = rescored;
        renderGlyphPanel(panel, rescored, locale, (patch, opts) => applyGlyphToForm(patch, opts), null);
      }, 400);
    });
  }
}

async function runGlyphForEditor() {
  if (!isGlyphEnabled(state.settings)) return;
  const panel = document.getElementById('glyphPanel');
  if (!panel || !editingTrackId) return;
  const track = state.tracks.find((tr) => tr.id === editingTrackId);
  if (!track) return;
  renderGlyphLoading(panel, track, locale);
  const analysis = await runGlyphAnalysis(track, state, locale, api);
  lastGlyphAnalysis = analysis;
  lastGlyphFields = analysis.result?.fields || null;
  await logGlyphSuggest(api, state.settings, track, analysis, state);
  const onReject = () => {
    void logGlyphReject(api, state.settings, track, {
      before: tagEditSession?.before ?? pickTags(track),
      suggested: pickTags(lastGlyphFields),
      glyph: glyphMetaFromAnalysis(lastGlyphAnalysis),
      state,
    });
    showToast(t('glyph.rejected', locale), 'info', 3000);
  };
  renderGlyphPanel(
    panel,
    analysis,
    locale,
    (patch, opts) => applyGlyphToForm(patch, { ...opts, save: opts?.save }),
    onReject
  );
  if (panel.dataset.glyphLiveBound !== '1') {
    panel.dataset.glyphLiveBound = '1';
    bindGlyphEditorLive(panel);
  }
  panel.addEventListener(
    'glyph-rerun',
    async () => {
      await runGlyphForEditor();
    },
    { once: true }
  );
}

function openTagEditor(trackId) {
  const track = state.tracks.find((tr) => tr.id === trackId);
  if (!track) return;
  editingTrackId = trackId;
  pendingCover = null;
  tagEditSession = { trackId, before: pickTags(track) };
  lastGlyphAnalysis = null;
  lastGlyphFields = null;
  document.getElementById('tagTitle').value = track.title || '';
  document.getElementById('tagArtist').value = track.artist || '';
  document.getElementById('tagAlbum').value = track.album || '';
  document.getElementById('tagGenre').value = track.genre || '';
  document.getElementById('tagYear').value = track.year || '';
  document.getElementById('tagTrackNo').value = track.trackNo || '';
  tagEditor.classList.remove('hidden');
  applyTagEditorGlyphUi();
  refreshTagCoverPreview(track);
  if (isGlyphEnabled(state.settings)) runGlyphForEditor();
}

async function refreshTagCoverPreview(track) {
  const wrap = document.getElementById('tagCoverPreviewWrap');
  const img = document.getElementById('tagCoverPreview');
  if (!wrap || !img || !track) return;
  const url = await api.coverUrl(track.id);
  if (url) {
    img.src = url;
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
    img.removeAttribute('src');
  }
}

function closeTrackContextMenu() {
  document.getElementById('trackContextMenu')?.classList.add('hidden');
  contextMenuTrackId = null;
}

function openTrackContextMenu(e, trackId) {
  contextMenuTrackId = trackId;
  const menu = document.getElementById('trackContextMenu');
  if (!menu) return;
  const lockBtn = menu.querySelector('[data-ctx="lock"]');
  if (lockBtn) {
    lockBtn.textContent = state.settings.clickLock ? t('ctx.unlock', locale) : t('ctx.lock', locale);
  }
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  menu.classList.remove('hidden');
}

function bindTrackRows() {
  content.querySelectorAll('.track-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input')) return;
      if (state.settings.clickLock) return;
      const queue =
        currentView === 'recent'
          ? getRecentTracks()
          : currentView === 'favorites'
            ? state.tracks.filter((tr) => favoriteSet().has(tr.id))
            : null;
      playById(row.dataset.id, queue);
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openTrackContextMenu(e, row.dataset.id);
    });
  });
  content.querySelectorAll('[data-edit-tags]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTagEditor(btn.dataset.editTags);
    });
  });
  content.querySelectorAll('[data-add-playlist]').forEach((btn) => {
    setIcon(btn, 'plus');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPlaylistPicker(btn.dataset.addPlaylist);
    });
  });
  content.querySelectorAll('[data-fav-track]').forEach((btn) => {
    setIcon(btn, btn.classList.contains('track-fav--on') ? 'heart' : 'heartOutline');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.favTrack);
    });
  });
  content.querySelector('[data-capsule-play]')?.addEventListener('click', (e) => {
    playById(e.currentTarget.dataset.capsulePlay);
  });
  content.querySelectorAll('.journal-row[data-id], .journal-top-row--track[data-id]').forEach((row) => {
    if (!row.dataset.id) return;
    row.addEventListener('click', () => {
      if (!state.settings.clickLock) playById(row.dataset.id);
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openTrackContextMenu(e, row.dataset.id);
    });
  });
  content.querySelectorAll('.card[data-album]').forEach((card) => {
    card.addEventListener('click', () => {
      const [artist, album] = card.dataset.album.split('::');
      openAlbumFocus(artist, album);
    });
  });
  content.querySelectorAll('.card[data-artist-id]').forEach((card) => {
    card.addEventListener('click', () => {
      openArtistFocus(card.dataset.artistId, card.dataset.artistName);
    });
  });
  content.querySelectorAll('.artist-link').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openArtistFocus(btn.dataset.artistId, btn.dataset.artistName);
    });
  });
}

function bindPlaylists() {
  document.getElementById('btnCreatePlaylist')?.addEventListener('click', async () => {
    const input = document.getElementById('playlistNameInput');
    const name = input?.value?.trim();
    if (!name) return;
    const pl = await api.playlistCreate(name);
    state.playlists.push(pl);
    input.value = '';
    setView('playlists');
  });

  content.querySelectorAll('[data-playlist]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-playlist]')) return;
      const slug = el.dataset.playlist;
      const pl = state.playlists.find((p) => p.slug === slug);
      if (!pl) return;
      const tracks = pl.trackIds.map((id) => state.tracks.find((tr) => tr.id === id)).filter(Boolean);
      const detail = document.getElementById('playlistDetail');
      detail.classList.remove('hidden');
      const rowHtml = tracks
        .map((tr, i) =>
          renderTrackRow(
            tr,
            i,
            locale,
            `<button type="button" class="btn" data-remove-from-playlist="${tr.id}" data-pl-slug="${pl.slug}">${t('playlists.removeFrom', locale)}</button>`
          )
        )
        .join('');
      detail.innerHTML = `
        <div class="view-head"><h1>${pl.name}</h1><p>${tf('view.playlistTracks', locale, { n: tracks.length })}</p></div>
        <div class="track-list">${rowHtml}</div>
        <button type="button" class="btn btn-primary" id="playPlaylist" style="margin-top:12px" data-i18n="playlists.play">${t('playlists.play', locale)}</button>`;
      bindTrackRows();
      content.querySelectorAll('[data-remove-from-playlist]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const trackId = btn.dataset.removeFromPlaylist;
          pl.trackIds = pl.trackIds.filter((id) => id !== trackId);
          await api.playlistSave(pl);
          const idx = state.playlists.findIndex((p) => p.id === pl.id);
          if (idx >= 0) state.playlists[idx] = pl;
          el.click();
        });
      });
      document.getElementById('playPlaylist')?.addEventListener('click', () => {
        if (tracks.length) player.playTrack(tracks[0], tracks, 0);
      });
    });
  });

  content.querySelectorAll('[data-smart-playlist]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.smartPlaylist;
      const pl = state.smartPlaylists.find((p) => p.id === id);
      if (!pl) return;
      const tracks = evaluateSmartPlaylist(state.tracks, pl, {
        playHistory: state.playHistory,
        favorites: favoriteSet(),
      });
      const detail = document.getElementById('playlistDetail');
      detail.classList.remove('hidden');
      const rowHtml = tracks
        .map((tr, i) => renderTrackRow(tr, i, locale, '', { showFavorite: true, favorite: favoriteSet().has(tr.id) }))
        .join('');
      detail.innerHTML = `
        <div class="view-head"><h1>${pl.name}</h1><p>${tf('view.playlistTracks', locale, { n: tracks.length })} · ${t('playlists.smartHint', locale)}</p></div>
        <div class="track-list">${rowHtml || `<div class="empty-state">${t('playlists.smartEmpty', locale)}</div>`}</div>
        <button type="button" class="btn btn-primary" id="playSmartPlaylist" style="margin-top:12px">${t('playlists.play', locale)}</button>`;
      bindTrackRows();
      document.getElementById('playSmartPlaylist')?.addEventListener('click', () => {
        if (tracks.length) player.playTrack(tracks[0], tracks, 0);
      });
    });
  });

  content.querySelectorAll('[data-delete-playlist]').forEach((btn) => {
    setIcon(btn, 'close');
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await api.playlistDelete(btn.dataset.deletePlaylist);
      state.playlists = state.playlists.filter((p) => p.slug !== btn.dataset.deletePlaylist);
      setView('playlists');
    });
  });
}

function showSettingsSection(section) {
  settingsSection = section;
  content.querySelectorAll('[data-settings-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.settingsPanel !== section);
  });
  content.querySelectorAll('.settings-nav-btn').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.settingsSection === section);
  });
  if (section === 'journal') bindTrackRows();
  if (section === 'library') bindLibraryTree();
  if (section === 'profile') bindProfileSettings();
  if (section === 'glyph') {
    refreshGlyphMiStatusLine();
    refreshGlyphOnlineStatus();
    refreshGlyphLearnStats();
    refreshGlyphLibraryStats();
  }
}

async function updateProfileChrome() {
  const profile = state.profile || (await api.profileGet());
  state.profile = profile;
  const btn = document.getElementById('profileChromeBtn');
  const img = document.getElementById('profileChromeAvatar');
  if (!btn || !img) return;
  btn.title = profile.displayName || t('settings.section_profile', locale);
  const customUrl = profile.useCustomAvatar ? await api.profileAvatarUrl() : '';
  img.src = customUrl || identiconToDataUrl(profile.avatarSeed || 'senza', 64);
}

async function refreshProfilePreview(profile = state.profile) {
  const canvas = document.getElementById('profileAvatarPreview');
  if (!canvas || !profile) return;
  if (profile.useCustomAvatar && !pendingProfileAvatar) {
    const url = await api.profileAvatarUrl();
    if (url) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 128);
        ctx.drawImage(img, 0, 0, 128, 128);
      };
      img.src = url;
      return;
    }
  }
  if (pendingProfileAvatar?.buffer) {
    const blob = new Blob([pendingProfileAvatar.buffer], { type: 'image/jpeg' });
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 128, 128);
      ctx.drawImage(img, 0, 0, 128, 128);
    };
    img.src = URL.createObjectURL(blob);
    return;
  }
  drawIdenticon(canvas, profile.avatarSeed || 'senza', 128);
}

function bindProfileSettings() {
  const panel = document.querySelector('[data-settings-panel="profile"]');
  if (!panel || panel.dataset.bound) return;
  panel.dataset.bound = '1';
  refreshProfilePreview();
  document.getElementById('profileRandomName')?.addEventListener('click', () => {
    const input = document.getElementById('profileDisplayName');
    if (input) input.value = randomDisplayName(randomProfileSeed());
  });
  document.getElementById('profileRandomAvatar')?.addEventListener('click', () => {
    state.profile.avatarSeed = randomProfileSeed();
    state.profile.useCustomAvatar = false;
    pendingProfileAvatar = null;
    refreshProfilePreview();
  });
  document.getElementById('profileUploadAvatar')?.addEventListener('click', async () => {
    const picked = await api.pickCover();
    const bytes = picked?.buffer;
    if (!bytes?.length) return;
    openCoverCropModal(new Blob([new Uint8Array(bytes)]), locale, async ({ buffer }) => {
      pendingProfileAvatar = { buffer };
      state.profile.useCustomAvatar = true;
      refreshProfilePreview();
    });
  });
  document.getElementById('profileSave')?.addEventListener('click', async () => {
    const name = document.getElementById('profileDisplayName')?.value?.trim();
    const payload = {
      displayName: name || state.profile.displayName,
      avatarSeed: state.profile.avatarSeed,
      useCustomAvatar: state.profile.useCustomAvatar,
    };
    if (pendingProfileAvatar?.buffer) {
      payload.avatarBuffer = Array.from(new Uint8Array(pendingProfileAvatar.buffer));
      payload.useCustomAvatar = true;
    }
    state.profile = await api.profileSave(payload);
    pendingProfileAvatar = null;
    await saveState();
    await updateProfileChrome();
    refreshProfilePreview();
  });
}

async function bindLibraryTree() {
  const el = document.getElementById('libraryTree');
  if (!el) return;
  try {
    const tree = await api.libraryTree();
    const html = renderLibraryTreeHtml(tree);
    el.innerHTML = html || t('library.treeEmpty', locale);
  } catch {
    el.textContent = t('library.treeEmpty', locale);
  }
}

function bindLibrarySettings() {
  document.getElementById('btnOpenLibraryFolder')?.addEventListener('click', async () => {
    if (libraryRoot) await api.openPath(libraryRoot);
  });
  document.getElementById('btnRefreshLibraryTree')?.addEventListener('click', () => bindLibraryTree());
  document.getElementById('btnLibraryExport')?.addEventListener('click', async () => {
    try {
      const r = await api.libraryExport();
      if (r?.canceled) return;
      showToast(t('library.exportDone', locale), 'success');
    } catch (err) {
      showToast(err.message || String(err), 'error');
    }
  });
  document.getElementById('btnLibraryImport')?.addEventListener('click', async () => {
    try {
      const r = await api.libraryImport({ merge: false });
      if (r?.canceled) return;
      await loadState();
      syncPlayerQueueFromState();
      showToast(t('library.importDone', locale), 'success');
      setView('tracks');
    } catch (err) {
      showToast(err.message || String(err), 'error');
    }
  });
  document.getElementById('btnPickWatchedFolder')?.addEventListener('click', async () => {
    const folder = await api.pickWatchedFolder?.();
    if (!folder) return;
    state.settings.watchedFolder = folder;
    await saveState();
    await api.watchedFolderStart?.(folder);
    showToast(t('library.watchedStarted', locale), 'success');
    setView('settings');
  });
  document.getElementById('btnStopWatchedFolder')?.addEventListener('click', async () => {
    await api.watchedFolderStop?.();
    state.settings.watchedFolder = '';
    await saveState();
    showToast(t('library.watchedStopped', locale), 'info');
    setView('settings');
  });
}

async function bindArtistAvatars() {
  const els = content.querySelectorAll('.artist-portrait[data-artist-slug]');
  await Promise.all(
    [...els].map(async (el) => {
      const slug = el.dataset.artistSlug;
      const name = el.dataset.artistName || '';
      if (!slug) {
        applyArtistPortrait(el, name, null);
        return;
      }
      try {
        const url = await api.artistAvatarUrl(slug);
        if (!url) {
          applyArtistPortrait(el, name, null);
          return;
        }
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            applyArtistPortrait(el, name, url);
            resolve();
          };
          img.onerror = () => {
            applyArtistPortrait(el, name, null);
            resolve();
          };
          img.src = url;
        });
      } catch {
        applyArtistPortrait(el, name, null);
      }
    })
  );
}

async function pickArtistPhoto(slug) {
  const picked = await api.pickCover();
  const bytes = picked?.buffer;
  if (bytes?.length) {
    openCoverCropModal(new Blob([new Uint8Array(bytes)]), locale, async ({ buffer }) => {
      await api.artistAvatarSave({ slug, buffer: Array.from(new Uint8Array(buffer)) });
      await bindArtistAvatars();
      showToast(locale === 'ru' ? 'Фото исполнителя сохранено' : 'Artist photo saved', 'success');
    });
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    openCoverCropModal(file, locale, async ({ buffer }) => {
      await api.artistAvatarSave({ slug, buffer: Array.from(new Uint8Array(buffer)) });
      await bindArtistAvatars();
      showToast(locale === 'ru' ? 'Фото исполнителя сохранено' : 'Artist photo saved', 'success');
    });
  };
  input.click();
}

async function bindCardArtwork() {
  const els = content.querySelectorAll('[data-cover-track-id]');
  await Promise.all(
    [...els].map(async (el) => {
      const id = el.dataset.coverTrackId;
      const track = id
        ? state.tracks.find((t) => t.id === id)
        : {
            artist: el.dataset.artist || '',
            album: el.dataset.albumName || '',
            title: el.dataset.albumName || '',
          };
      if (!id || !track) {
        applyArtworkElement(el, track, null);
        return;
      }
      try {
        const url = await api.coverUrl(id);
        if (!url) {
          applyArtworkElement(el, track, null);
          return;
        }
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            applyArtworkElement(el, track, url);
            resolve();
          };
          img.onerror = () => {
            applyArtworkElement(el, track, null);
            resolve();
          };
          img.src = url;
        });
      } catch {
        applyArtworkElement(el, track, null);
      }
    })
  );
}

function paintVaultView() {
  content.innerHTML = renderVaultView(
    state.tracks,
    locale,
    vaultDetailFilter,
    vaultGlyphScan,
    vaultGlyphLoading,
    isGlyphEnabled(state.settings)
  );
  bindVault();
  bindTrackRows();
  applyI18n(locale);
}

async function refreshVaultGlyphScan() {
  if (!isGlyphEnabled(state.settings)) {
    vaultGlyphScan = null;
    vaultGlyphLoading = false;
    if (currentView === 'vault') paintVaultView();
    return;
  }
  vaultGlyphLoading = true;
  if (currentView === 'vault') paintVaultView();
  try {
    vaultGlyphScan = await scanVaultLibrary(state.tracks, state, { maxFixPreview: 12, api });
  } catch (err) {
    console.warn('Vault Glyph scan:', err);
    vaultGlyphScan = null;
  }
  vaultGlyphLoading = false;
  if (currentView === 'vault') paintVaultView();
}

function bindVault() {
  bindHints(content);
}

async function batchFixAlbumsWithGlyph() {
  const missing = tracksMissingAlbum(state.tracks);
  if (!missing.length) {
    showToast(t('vault.fixAlbumsNone', locale), 'info');
    return;
  }
  let fixed = 0;
  for (const tr of missing) {
    const enriched = trackWithInferredAlbum(tr, state.tracks);
    const album = String(enriched.album || '').trim();
    if (!album || album === 'Unknown Album') continue;
    try {
      await api.writeTags({
        trackId: tr.id,
        tags: { ...tr, album, year: enriched.year || tr.year },
      });
      fixed += 1;
    } catch {
      
    }
  }
  await loadState();
  showToast(tf('vault.fixAlbumsDone', locale, { n: fixed }), 'success');
  if (currentView === 'vault') {
    paintVaultView();
    refreshVaultGlyphScan();
  }
}

function flowPlaybackState() {
  const q = player.getQueue();
  const idx = player.getIndex();
  const track = q[idx] || null;
  const playing = track && !player.getAudio().paused;
  return { track, playing };
}

async function syncFlowPageVisuals() {
  const root = content.querySelector('.flow-view');
  if (!root) return;
  const { track, playing } = flowPlaybackState();
  await refreshFlowVisuals(root, track, playing, api);
  if (playing && track) startFlowBeatSync(root, audio, track);
  else stopFlowBeatSync();
}

function paintFlowView() {
  content.innerHTML = renderFlowView(locale, {
    mode: flowMode,
    wave: flowWave,
    generating: flowGenerating,
    trackCount: state.tracks.length,
    glyphEnabled: isGlyphEnabled(state.settings),
  });
  applyI18n(locale);
  syncFlowPageVisuals();
}

async function generateFlowWave(playAfter = false) {
  if (!state.tracks.length) return;
  flowGenerating = true;
  paintFlowView();
  await new Promise((r) => setTimeout(r, 480));
  const { tracks, exhausted } = buildFlowWave(state.tracks, state.playHistory, {
    mode: flowMode,
    sessionPlayed: flowSessionPlayed,
    size: 32,
    favoriteIds: favoriteSet(),
  });
  if (exhausted) {
    flowSessionPlayed.clear();
    const again = buildFlowWave(state.tracks, state.playHistory, {
      mode: flowMode,
      sessionPlayed: flowSessionPlayed,
      size: 32,
      favoriteIds: favoriteSet(),
    });
    flowWave = again.tracks;
  } else {
    flowWave = tracks;
  }
  flowGenerating = false;
  paintFlowView();
  if (playAfter && flowWave.length) playFlowWave();
  else if (flowWave.length) {
    showToast(tf('flow.waveReady', locale, { n: flowWave.length }), 'success');
  }
}

function playFlowWave() {
  if (!flowWave.length) return;
  for (const tr of flowWave) flowSessionPlayed.add(tr.id);
  player.playTrack(flowWave[0], flowWave, 0);
  showToast(t('flow.playing', locale), 'info', 3000);
}

async function removeDuplicateGroup(groupId) {
  const group = vaultGlyphScan?.duplicateGroups?.find((g) => g.id === groupId);
  if (!group?.removeIds?.length) return;
  const choice = await confirmBulkRemove(group.removeIds.length, locale);
  if (!choice) return;
  for (const id of group.removeIds) {
    await api.removeTrack({ trackId: id, deleteFile: Boolean(choice.deleteFile) });
  }
  await loadState();
  syncPlayerQueueFromState();
  showToast(tf('glyph.dupRemoved', locale, { n: group.removeIds.length }), 'success');
  await refreshVaultGlyphScan();
}

function bindSettings() {
  content.querySelectorAll('[data-settings-section]').forEach((btn) => {
    btn.addEventListener('click', () => showSettingsSection(btn.dataset.settingsSection));
  });

  document.getElementById('settingTheme')?.addEventListener('change', async (e) => {
    state.settings.theme = e.target.value;
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    await saveState();
  });
  document.getElementById('settingLang')?.addEventListener('change', async (e) => {
    locale = e.target.value;
    localStorage.setItem('senza-lang', locale);
    state.settings.locale = locale;
    await saveState();
    applyI18n(locale);
    setView(currentView);
  });
  document.getElementById('settingCollection')?.addEventListener('change', async (e) => {
    state.settings.collectionMode = e.target.checked;
    await saveState();
  });
  document.getElementById('settingVolume')?.addEventListener('input', async (e) => {
    const v = Number(e.target.value);
    audio.volume = v;
    document.getElementById('volume').value = v;
    state.settings.volume = v;
    await saveState();
  });
  document.getElementById('settingClickLock')?.addEventListener('change', async (e) => {
    state.settings.clickLock = e.target.checked;
    await saveState();
  });
  document.getElementById('settingAccent')?.addEventListener('input', async (e) => {
    state.settings.accentColor = e.target.value;
    applyAccentColor(state.settings.accentColor);
    await saveState();
  });
  document.getElementById('settingReplayGain')?.addEventListener('change', async (e) => {
    state.settings.replayGainEnabled = e.target.checked;
    await saveState();
  });
  document.getElementById('settingCrossfade')?.addEventListener('input', async (e) => {
    const v = Number(e.target.value);
    state.settings.crossfadeSec = v;
    player.setCrossfadeSec?.(v);
    const lbl = document.getElementById('crossfadeLabel');
    if (lbl) lbl.textContent = `${v}s`;
    await saveState();
  });
  document.getElementById('settingLyrics')?.addEventListener('change', async (e) => {
    state.settings.lyricsEnabled = e.target.checked;
    if (!e.target.checked) {
      document.getElementById('playerLyrics')?.classList.add('hidden');
      lyricsOpen = false;
    }
    await saveState();
  });
  bindLibrarySettings();
  bindNavCustomize();
  bindGlyphSettings();
  bindHints(content);
}

function bindNavCustomize() {
  content.querySelectorAll('.nav-custom-visible').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const id = cb.dataset.navId;
      const cfg = normalizeNavConfig(state.settings.navConfig);
      const entry = cfg.find((c) => c.id === id);
      if (entry) entry.visible = cb.checked;
      state.settings.navConfig = cfg.map((c, i) => ({ ...c, order: i }));
      await saveState();
      buildSidebar();
    });
  });

  const moveNav = async (id, delta) => {
    const cfg = normalizeNavConfig(state.settings.navConfig);
    const idx = cfg.findIndex((c) => c.id === id);
    const swap = idx + delta;
    if (idx < 0 || swap < 0 || swap >= cfg.length) return;
    [cfg[idx], cfg[swap]] = [cfg[swap], cfg[idx]];
    state.settings.navConfig = cfg.map((c, i) => ({ ...c, order: i }));
    await saveState();
    settingsSection = 'appearance';
    setView('settings');
  };

  content.querySelectorAll('.nav-custom-up').forEach((btn) => {
    btn.addEventListener('click', () => moveNav(btn.dataset.navId, -1));
  });
  content.querySelectorAll('.nav-custom-down').forEach((btn) => {
    btn.addEventListener('click', () => moveNav(btn.dataset.navId, 1));
  });
}

async function refreshGlyphLearnStats() {
  const el = document.getElementById('glyphLearnStats');
  if (!el) return;
  try {
    const [jsonl, analytics] = await Promise.all([
      api.glyphLearnStats?.() ?? Promise.resolve(null),
      api.glyphAnalytics?.() ?? Promise.resolve(null),
    ]);
    const jsonlParts = Object.entries(jsonl?.byEvent || {})
      .map(([k, n]) => `${k}: ${n}`)
      .join(' · ');
    const sources =
      analytics?.ok && analytics.topSources?.length
        ? analytics.topSources.map((s) => `${s.name}: ${s.count}`).join(' · ')
        : '—';
    el.innerHTML = `
      <div class="glyph-analytics">
        <p><strong>${tf('glyph.analyticsIndexed', locale, { n: analytics?.indexed ?? 0, total: analytics?.trackCount ?? state.tracks.length })}</strong></p>
        <p>${tf('glyph.analyticsConfidence', locale, { n: analytics?.avgConfidence ?? '—' })}</p>
        <p>${tf('glyph.analyticsCounter', locale, { n: analytics?.counterexamples ?? 0 })}</p>
        <p class="settings-field-hint">${t('glyph.analyticsSources', locale)}: ${escHtml(sources)}</p>
        <p class="settings-field-hint">${tf('glyph.analyticsOllama', locale, { calls: analytics?.ollamaCalls ?? 0, useful: analytics?.ollamaUseful ?? 0 })}</p>
        <p class="settings-field-hint">${tf('glyph.analyticsDb', locale, { events: analytics?.logTotal ?? 0, diffs: analytics?.diffTotal ?? 0, kb: Math.round((analytics?.bytes || 0) / 1024) })}</p>
        <p class="settings-field-hint muted">${t('glyph.analyticsJsonl', locale)}: ${jsonl?.total ?? 0} · ${jsonlParts || '—'}</p>
      </div>`;
  } catch {
    el.innerHTML = `<p class="settings-field-hint">${t('glyph.statsError', locale)}</p>`;
  }
}

let glyphBatchCancelRef = null;

function ensureGlyphBatchModal() {
  let el = document.getElementById('glyphBatchModal');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'glyphBatchModal';
  el.className = 'glyph-batch-modal hidden';
  el.innerHTML = `
    <div class="glyph-batch-dialog" role="dialog" aria-modal="true">
      <h2 id="glyphBatchTitle"></h2>
      <p id="glyphBatchStatus" class="glyph-batch-status"></p>
      <div class="glyph-batch-progress"><div id="glyphBatchBar" class="glyph-batch-bar"></div></div>
      <p id="glyphBatchSummary" class="settings-field-hint"></p>
      <div class="glyph-batch-actions">
        <button type="button" class="btn" id="glyphBatchCancel">${t('glyph.batchCancel', locale)}</button>
        <button type="button" class="btn btn-primary hidden" id="glyphBatchApply">${t('glyph.batchApply', locale)}</button>
        <button type="button" class="btn hidden" id="glyphBatchClose">${t('glyph.batchClose', locale)}</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#glyphBatchCancel')?.addEventListener('click', () => {
    if (glyphBatchCancelRef) glyphBatchCancelRef.cancelled = true;
  });
  el.querySelector('#glyphBatchClose')?.addEventListener('click', () => {
    el.classList.add('hidden');
  });
  return el;
}

async function runGlyphBatchLibrary() {
  if (!state.tracks.length) {
    showToast(t('glyph.batchEmpty', locale), 'info');
    return;
  }
  const modal = ensureGlyphBatchModal();
  const title = modal.querySelector('#glyphBatchTitle');
  const status = modal.querySelector('#glyphBatchStatus');
  const bar = modal.querySelector('#glyphBatchBar');
  const summary = modal.querySelector('#glyphBatchSummary');
  const btnApply = modal.querySelector('#glyphBatchApply');
  const btnClose = modal.querySelector('#glyphBatchClose');
  const btnCancel = modal.querySelector('#glyphBatchCancel');

  modal.classList.remove('hidden');
  title.textContent = t('glyph.batchTitle', locale);
  status.textContent = t('glyph.batchScanning', locale);
  summary.textContent = '';
  bar.style.width = '0%';
  btnApply.classList.add('hidden');
  btnClose.classList.add('hidden');
  btnCancel.classList.remove('hidden');

  glyphBatchCancelRef = { cancelled: false };
  const maxScore = state.settings?.glyphBatchMaxScore ?? 60;

  const { results, scanned, cancelled } = await scanBatchCandidates(
    state.tracks,
    state,
    locale,
    api,
    {
      maxScore,
      limit: 400,
      cancelRef: glyphBatchCancelRef,
      onProgress: ({ done, total }) => {
        status.textContent = tf('glyph.batchProgress', locale, { done, total });
        bar.style.width = `${Math.round((done / total) * 100)}%`;
      },
    }
  );

  if (cancelled) {
    status.textContent = t('glyph.batchCancelled', locale);
    btnClose.classList.remove('hidden');
    return;
  }

  status.textContent = tf('glyph.batchFound', locale, { n: results.length, scanned });
  summary.textContent = tf('glyph.batchSummary', locale, {
    n: results.length,
    fields: results.reduce((a, r) => a + Object.keys(r.patch || {}).length, 0),
  });
  bar.style.width = '100%';

  if (!results.length) {
    btnClose.classList.remove('hidden');
    btnCancel.classList.add('hidden');
    return;
  }

  btnApply.classList.remove('hidden');
  btnApply.onclick = async () => {
    btnApply.disabled = true;
    status.textContent = t('glyph.batchApplying', locale);
    const { applied, fieldsWritten } = await applyBatchResults(results, api, {
      onProgress: ({ done, total }) => {
        bar.style.width = `${Math.round((done / total) * 100)}%`;
        status.textContent = tf('glyph.batchApplyProgress', locale, { done, total });
      },
    });
    await saveState();
    if (api.glyphDbSync) api.glyphDbSync(state.tracks).catch(() => {});
    showToast(tf('glyph.batchDone', locale, { n: applied, fields: fieldsWritten }), 'success', 8000);
    modal.classList.add('hidden');
    await refreshVaultGlyphScan();
  };
}

async function refreshGlyphMiStatusLine() {
  const el = document.getElementById('glyphMiStatus');
  if (!el) return;
  el.innerHTML = `<strong class="glyph-version-badge">Glyph2.2-O</strong> · ${tf('glyph.packsLine', locale, { n: GLYPH_PUBLIC_PACKS.length })}`;
}

async function refreshGlyphOnlineStatus() {
  const el = document.getElementById('glyphOnlineStatus');
  if (!el) return;
  const mbOn = state.settings.glyphUseMusicBrainz !== false;
  let fpcalc = false;
  try {
    const st = await api.glyphOnlineStatus();
    fpcalc = Boolean(st?.fpcalc);
  } catch {
    
  }
  const parts = [];
  if (mbOn) parts.push(`<span class="glyph-status-ok">${t('glyph.onlineMB', locale)}</span>`);
  else parts.push(`<span class="glyph-status-warn">${t('glyph.onlineOff', locale)}</span>`);
  if (fpcalc) parts.push(`<span class="glyph-status-ok">${t('glyph.onlineFpcalc', locale)}</span>`);
  else parts.push(`<span class="glyph-status-warn">${t('glyph.onlineFpcalcOff', locale)}</span>`);
  el.innerHTML = parts.join(' · ');
}

function refreshGlyphLibraryStats() {
  const el = document.getElementById('glyphLibraryStats');
  if (!el) return;
  const s = duplicateSummaryForTracks(state.tracks);
  el.innerHTML = `
    <div class="glyph-stats-grid">
      <div class="glyph-stat"><span class="glyph-stat-value">${s.total}</span><span class="glyph-stat-label">${t('glyph.statTracks', locale)}</span></div>
      <div class="glyph-stat"><span class="glyph-stat-value">${s.attention}</span><span class="glyph-stat-label">${t('glyph.statAttention', locale)}</span></div>
      <div class="glyph-stat"><span class="glyph-stat-value">${s.groupCount}</span><span class="glyph-stat-label">${t('glyph.statDupGroups', locale)}</span></div>
      <div class="glyph-stat"><span class="glyph-stat-value">${s.duplicateTrackCount}</span><span class="glyph-stat-label">${t('glyph.statDupFiles', locale)}</span></div>
    </div>
    <p class="settings-field-hint">${t('glyph.statHint', locale)}</p>`;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function bindGlyphSettings() {
  document.getElementById('settingGlyphEnabled')?.addEventListener('change', async (e) => {
    state.settings.glyphEnabled = e.target.checked;
    await saveState();
    applyTagEditorGlyphUi();
    if (currentView === 'flow') paintFlowView();
    if (currentView === 'vault') {
      vaultGlyphScan = null;
      paintVaultView();
      if (e.target.checked) refreshVaultGlyphScan();
    }
    setView('settings');
  });
  document.getElementById('settingGlyphUseMB')?.addEventListener('change', async (e) => {
    state.settings.glyphUseMusicBrainz = e.target.checked;
    await saveState();
  });
  document.getElementById('settingGlyphAutoApply')?.addEventListener('change', async (e) => {
    state.settings.glyphAutoApplyOnImport = e.target.checked;
    await saveState();
  });
  document.getElementById('settingGlyphLocal')?.addEventListener('change', async (e) => {
    state.settings.glyphTryLocal = e.target.checked;
    await saveState();
  });
  document.getElementById('settingGlyphLog')?.addEventListener('change', async (e) => {
    state.settings.glyphLogEnabled = e.target.checked;
    await saveState();
  });
  document.getElementById('settingGlyphLearn')?.addEventListener('change', async (e) => {
    state.settings.glyphLearnEnabled = e.target.checked;
    await saveState();
  });
  document.getElementById('settingGlyphContributor')?.addEventListener('change', async (e) => {
    state.settings.glyphContributorId = e.target.value.trim();
    await saveState();
  });
  document.getElementById('btnGlyphExport')?.addEventListener('click', async () => {
    try {
      const result = await api.glyphLearnExport({
        contributorId: state.settings.glyphContributorId || '',
      });
      showToast(tf('glyph.exportDone', locale, { n: result.entryCount }), 'success', 5000);
      await refreshGlyphLearnStats();
    } catch (err) {
      showToast(err.message || String(err), 'error');
    }
  });
  document.getElementById('btnGlyphExportDataset')?.addEventListener('click', async () => {
    try {
      const result = await api.glyphLogExportDataset({ onlyAccepted: true });
      showToast(tf('glyph.exportDatasetDone', locale, { n: result.count }), 'success', 6000);
      await refreshGlyphLearnStats();
    } catch (err) {
      showToast(err.message || String(err), 'error');
    }
  });
  document.getElementById('btnGlyphOpenExports')?.addEventListener('click', async () => {
    try {
      await api.glyphOpenExports();
    } catch (err) {
      showToast(err.message || String(err), 'error');
    }
  });
  document.getElementById('btnGlyphOpenVault')?.addEventListener('click', () => setView('vault'));
  document.getElementById('btnGlyphImportExport')?.addEventListener('click', async () => {
    try {
      const r = await api.glyphImportExport();
      showToast(tf('glyph.importExportDone', locale, { n: r.exampleCount }), 'success', 6000);
      await refreshGlyphMiStatusLine();
    } catch (err) {
      showToast(err.message || t('glyph.importExportHint', locale), 'error', 8000);
    }
  });
  refreshGlyphLearnStats();
  refreshGlyphMiStatusLine();
  refreshGlyphOnlineStatus();
  refreshGlyphLibraryStats();
}

function bindAlbumFocus(albumTracks) {
  const back = document.getElementById('albumBack');
  back?.querySelectorAll('[data-icon]').forEach((el) => setIcon(el, 'chevronLeft'));
  back?.addEventListener('click', () => {
    albumFocus = null;
    setView('albums');
  });
  document.getElementById('playAlbumFocus')?.addEventListener('click', () => {
    const sorted = sortAlbumTracks(albumTracks);
    if (sorted.length) player.playTrack(sorted[0], sorted, 0);
  });
}

function bindArtistFocus(artistTracks) {
  const back = document.getElementById('artistBack');
  back?.querySelectorAll('[data-icon]').forEach((el) => setIcon(el, 'chevronLeft'));
  back?.addEventListener('click', () => {
    artistFocus = null;
    setView('artists');
  });
  const slug = artistFocus?.id;
  const openPhoto = () => {
    if (slug) pickArtistPhoto(slug);
  };
  document.getElementById('artistPhotoBtn')?.addEventListener('click', openPhoto);
  document.getElementById('artistPortraitBtn')?.addEventListener('click', openPhoto);
  document.getElementById('playArtistFocus')?.addEventListener('click', () => {
    const sorted = sortAlbumTracks(artistTracks);
    if (sorted.length) player.playTrack(sorted[0], sorted, 0);
  });
}

function bindImport() {
  const zone = document.getElementById('importZone');
  const btnFiles = document.getElementById('btnPickFiles');
  const btnFolder = document.getElementById('btnPickFolder');
  if (!zone) return;

  btnFiles?.addEventListener('click', async () => {
    await afterImport(await api.pickFiles());
  });
  btnFolder?.addEventListener('click', async () => {
    await afterImport(await api.pickFolder());
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const paths = [...e.dataTransfer.files].map((f) => f.path).filter(Boolean);
    if (paths.length) await afterImport(await api.importPaths(paths));
  });
}

function setView(view) {
  const prevView = currentView;
  if (view !== 'album') albumFocus = null;
  if (view !== 'artist') artistFocus = null;
  if (view !== 'tracks') {
    bulkSelectMode = false;
    selectedTrackIds.clear();
    closeBulkEditor();
  }
  currentView = view;
  buildSidebar();
  document.querySelectorAll('.sidebar-footer .nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  const tracks = getFilteredTracks();
  const collectionMode = state.settings.collectionMode;

  switch (view) {
    case 'tracks': {
      const st = state.settings.sortTracks;
      content.innerHTML = renderTracksView(tracks, locale, {
        bulkMode: bulkSelectMode,
        selectedIds: selectedTrackIds,
        showBulk: true,
        showSort: true,
        sortKey: st.key,
        sortDir: st.dir,
        favoriteIds: favoriteSet(),
        rowOpts: { showFavorite: true },
      });
      bindBulkToolbar();
      bindTrackSelectCheckboxes();
      bindSortBar('sort', 'sortTracks');
      break;
    }
    case 'albums': {
      const sa = state.settings.sortAlbums;
      content.innerHTML = renderAlbumsView(tracks, locale, collectionMode, {
        sortKey: sa.key,
        sortDir: sa.dir,
        showSort: true,
      });
      bindSortBar('sortAlbums', 'sortAlbums');
      break;
    }
    case 'collection':
      content.innerHTML = renderCollectionView(tracks, locale);
      break;
    case 'artists': {
      const sa = state.settings.sortArtists;
      content.innerHTML = renderArtistsView(tracks, locale, {
        sortKey: sa.key,
        sortDir: sa.dir,
        showSort: true,
      });
      bindSortBar('sortArtists', 'sortArtists');
      break;
    }
    case 'artist':
      if (!artistFocus) {
        content.innerHTML = renderArtistsView(tracks, locale);
        break;
      }
      {
        const artistTracks = state.tracks.filter((tr) => trackIncludesArtist(tr, artistFocus.name));
        content.innerHTML = renderArtistDetailView(
          artistFocus.id,
          artistFocus.name,
          artistTracks,
          locale
        );
        bindArtistFocus(artistTracks);
      }
      break;
    case 'playlists':
      content.innerHTML = renderPlaylistsView(state.playlists, locale, state.smartPlaylists);
      bindPlaylists();
      break;
    case 'flow':
      content.classList.remove('content--settings');
      content.classList.add('content--flow');
      paintFlowView();
      break;
    case 'recent': {
      const recentTracks = [];
      const seen = new Set();
      for (let i = (state.playHistory?.length || 0) - 1; i >= 0; i -= 1) {
        const e = state.playHistory[i];
        if (seen.has(e.trackId)) continue;
        const tr = state.tracks.find((t) => t.id === e.trackId);
        if (!tr) continue;
        seen.add(e.trackId);
        recentTracks.push(tr);
        if (recentTracks.length >= 50) break;
      }
      content.innerHTML = renderRecentView(state.tracks, state.playHistory, locale, favoriteSet());
      break;
    }
    case 'favorites':
      content.innerHTML = renderFavoritesView(state.tracks, favoriteSet(), locale);
      break;
    case 'vault':
      content.classList.remove('content--settings');
      if (prevView !== 'vault') {
        vaultDetailFilter = null;
        vaultGlyphScan = null;
      }
      paintVaultView();
      refreshVaultGlyphScan();
      break;
    case 'album':
      if (!albumFocus) {
        content.innerHTML = renderAlbumsView(tracks, locale, collectionMode);
        break;
      }
      {
        const albumTracks = state.tracks.filter(
          (tr) => tr.artist === albumFocus.artist && tr.album === albumFocus.album
        );
        content.innerHTML = renderAlbumDetailView(
          albumFocus.artist,
          albumFocus.album,
          albumTracks,
          locale
        );
        bindAlbumFocus(albumTracks);
      }
      break;
    case 'import':
      content.innerHTML = renderImportView(locale);
      bindImport();
      break;
    case 'settings':
      content.classList.add('content--settings');
      content.innerHTML = renderSettingsView(
        locale,
        { ...state.settings, profile: state.profile },
        libraryRoot,
        settingsSection,
        state.playHistory,
        state.tracks,
        state.usage
      );
      bindSettings();
      if (settingsSection === 'library') bindLibraryTree();
      if (settingsSection === 'profile') bindProfileSettings();
      break;
    default:
      content.classList.remove('content--settings');
      {
        const st = state.settings.sortTracks;
        content.innerHTML = renderTracksView(tracks, locale, {
          bulkMode: bulkSelectMode,
          selectedIds: selectedTrackIds,
          showBulk: true,
          showSort: true,
          sortKey: st.key,
          sortDir: st.dir,
        });
        bindBulkToolbar();
        bindTrackSelectCheckboxes();
        bindSortBar('sort', 'sortTracks');
      }
  }
  if (view !== 'settings') content.classList.remove('content--settings');
  if (view !== 'flow') {
    content.classList.remove('content--flow');
    stopFlowBeatSync();
  }
  bindTrackRows();
  if (['albums', 'collection', 'album'].includes(view)) bindCardArtwork();
  if (['artists', 'artist'].includes(view)) bindArtistAvatars();
  applyI18n(locale);
}

function renderQueue(queue, currentIndex) {
  queueList.innerHTML = queue
    .map(
      (tr, i) => `
    <li data-idx="${i}" draggable="true" class="${i === currentIndex ? 'active' : ''}">
      <strong>${tr.title}</strong><br><span style="color:var(--text-muted)">${formatArtistsDisplay(tr.artist)}</span>
    </li>`
    )
    .join('');

  let dragFrom = null;
  queueList.querySelectorAll('li').forEach((li) => {
    li.addEventListener('dragstart', () => {
      dragFrom = Number(li.dataset.idx);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drag-over');
      const to = Number(li.dataset.idx);
      if (dragFrom !== null) player.reorderQueue(dragFrom, to);
      dragFrom = null;
    });
    li.addEventListener('dblclick', () => {
      const q = player.getQueue();
      player.playTrack(q[Number(li.dataset.idx)], q, Number(li.dataset.idx));
    });
  });
}

document.getElementById('btnQueue')?.addEventListener('click', () => queuePanel.classList.toggle('hidden'));
document.getElementById('queueClose')?.addEventListener('click', () => queuePanel.classList.add('hidden'));
document.getElementById('btnLyrics')?.addEventListener('click', () => {
  lyricsOpen = !lyricsOpen;
  const el = document.getElementById('playerLyrics');
  el?.classList.toggle('hidden', !lyricsOpen);
  setIcon('btnLyrics', 'lyrics');
});
document.getElementById('volume')?.addEventListener('input', (e) => {
  audio.volume = Number(e.target.value);
  state.settings.volume = audio.volume;
  player.setBaseVolume?.(audio.volume);
  saveState();
});

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value;
  if (['flow', 'tracks', 'albums', 'artists', 'collection', 'album', 'artist', 'vault'].includes(currentView)) {
    setView(currentView);
  }
});

sidebarNav.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (btn) setView(btn.dataset.view);
});

document.querySelector('.sidebar-footer').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  setView(btn.dataset.view);
});

function initChromeIcons() {
  setIcon('winMin', 'minimize');
  setIcon('winMax', 'maximize');
  setIcon('winClose', 'close');
  setIcon('btnPrev', 'prev');
  setIcon('btnNext', 'next');
  setIcon('btnPlay', 'play');
  setIcon('btnQueue', 'queue');
  setIcon('queueClose', 'close');
  setIcon('tagEditorClose', 'close');
  setIcon('bulkEditorClose', 'close');
  setIcon('npArt', 'music');
  document.querySelectorAll('.sidebar-footer [data-icon]').forEach((el) => setIcon(el, el.dataset.icon));
}

document.getElementById('winMin')?.addEventListener('click', () => api.windowMinimize());
document.getElementById('winMax')?.addEventListener('click', async () => {
  const max = await api.windowToggleMaximize();
  setIcon('winMax', max ? 'restore' : 'maximize');
});
document.getElementById('winClose')?.addEventListener('click', () => api.windowClose());

document.getElementById('tagEditorClose').addEventListener('click', () => {
  tagEditor.classList.add('hidden');
  editingTrackId = null;
});

document.getElementById('tagGlyphRun')?.addEventListener('click', () => {
  if (editingTrackId && isGlyphEnabled(state.settings)) runGlyphForEditor();
});

async function openCoverPickerForTags() {
  const picked = await api.pickCover();
  const bytes = picked?.buffer;
  if (bytes?.length) {
    openCoverCropModal(new Blob([new Uint8Array(bytes)]), locale, onCoverCropped);
    return;
  }
  document.getElementById('coverFileInput')?.click();
}

function onCoverCropped({ buffer, mime }) {
  pendingCover = { buffer, mime };
  const blob = new Blob([buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const img = document.getElementById('tagCoverPreview');
  const wrap = document.getElementById('tagCoverPreviewWrap');
  if (img) img.src = url;
  wrap?.classList.remove('hidden');
  const track = state.tracks.find((tr) => tr.id === editingTrackId);
  if (track) playerChrome?.refreshArtwork({ ...track, hasCover: true });
}

document.getElementById('tagCover')?.addEventListener('click', () => {
  openCoverPickerForTags();
});

document.getElementById('coverFileInput')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  openCoverCropModal(file, locale, onCoverCropped);
});

document.getElementById('tagForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingTrackId) return;
  const tags = {
    title: document.getElementById('tagTitle').value,
    artist: document.getElementById('tagArtist').value,
    album: document.getElementById('tagAlbum').value,
    genre: document.getElementById('tagGenre').value,
    year: document.getElementById('tagYear').value,
    trackNo: document.getElementById('tagTrackNo').value,
  };
  if (pendingCover?.buffer) {
    tags.coverBuffer = Array.from(new Uint8Array(pendingCover.buffer));
    tags.coverMime = pendingCover.mime || 'image/jpeg';
  }
  try {
    const after = pickTagsFromForm();
    const suggested = lastGlyphFields ? pickTags(lastGlyphFields) : null;
    await logGlyphEvent(api, state.settings, editingTrackId, 'tag_save', {
      before: tagEditSession?.before,
      suggested,
      after,
      glyph: glyphMetaFromAnalysis(lastGlyphAnalysis),
      accepted: suggested ? tagsMatch(suggested, after) : null,
    });

    const updated = await api.writeTags({ trackId: editingTrackId, tags });
    const idx = state.tracks.findIndex((tr) => tr.id === editingTrackId);
    if (idx >= 0) state.tracks[idx] = { ...state.tracks[idx], ...updated };
    pendingCover = null;
    await saveState();
    tagEditor.classList.add('hidden');
    editingTrackId = null;
    tagEditSession = null;
    lastGlyphAnalysis = null;
    lastGlyphFields = null;
    const playing = player.getQueue()[player.getIndex()];
    if (playing) playerChrome?.refreshArtwork(playing);
    setView(currentView);
  } catch (err) {
    showToast(err.message || String(err), 'error', 5600);
  }
});

document.getElementById('profileChromeBtn')?.addEventListener('click', () => {
  settingsSection = 'profile';
  setView('settings');
});

document.getElementById('trackContextMenu')?.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const id = contextMenuTrackId;
    const action = btn.dataset.ctx;
    closeTrackContextMenu();
    if (!id) return;
    if (action === 'play') playById(id);
    if (action === 'playlist') openPlaylistPicker(id);
    if (action === 'tags') openTagEditor(id);
    if (action === 'reveal') {
      const track = state.tracks.find((tr) => tr.id === id);
      if (track?.path) await api.openPath(track.path);
    }
    if (action === 'remove') {
      if (await removeTrackById(id)) setView(currentView);
    }
    if (action === 'lock') {
      state.settings.clickLock = !state.settings.clickLock;
      await saveState();
    }
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#trackContextMenu')) closeTrackContextMenu();
});

document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.getElementById('dropOverlay').classList.remove('hidden');
});
document.body.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) document.getElementById('dropOverlay').classList.add('hidden');
});
document.body.addEventListener('drop', async (e) => {
  e.preventDefault();
  document.getElementById('dropOverlay').classList.add('hidden');
  const paths = [...e.dataTransfer.files].map((f) => f.path).filter(Boolean);
  if (paths.length) await afterImport(await api.importPaths(paths));
});

document.getElementById('playlistPickerBackdrop')?.addEventListener('click', () => {
  document.getElementById('playlistPicker')?.classList.add('hidden');
});
document.getElementById('playlistPickerClose')?.addEventListener('click', () => {
  document.getElementById('playlistPicker')?.classList.add('hidden');
});

document.getElementById('bulkEditorClose')?.addEventListener('click', closeBulkEditor);
document.getElementById('bulkCancel')?.addEventListener('click', closeBulkEditor);
document.getElementById('bulkForm')?.addEventListener('submit', applyBulkEditor);

function bindContentActions() {
  if (window.__senzaContentActions) return;
  window.__senzaContentActions = true;

  document.addEventListener('click', async (e) => {
    if (!e.target.closest('#content')) return;
    const vaultFilter = e.target.closest('[data-vault-filter]');
    if (vaultFilter) {
      const next = vaultFilter.dataset.vaultFilter;
      vaultDetailFilter = vaultDetailFilter === next ? null : next;
      paintVaultView();
      return;
    }
    if (e.target.closest('#btnVaultGlyphRescan')) {
      e.preventDefault();
      await refreshVaultGlyphScan();
      return;
    }
    if (e.target.closest('#btnGlyphBatch')) {
      e.preventDefault();
      await runGlyphBatchLibrary();
      return;
    }
    if (e.target.closest('#btnInsightsFixAlbums')) {
      e.preventDefault();
      await batchFixAlbumsWithGlyph();
      return;
    }
    const dup = e.target.closest('[data-glyph-remove-dup]');
    if (dup) {
      e.stopPropagation();
      if (await removeTrackById(dup.dataset.glyphRemoveDup)) await refreshVaultGlyphScan();
      return;
    }
    const dupG = e.target.closest('[data-glyph-remove-dup-group]');
    if (dupG) {
      e.stopPropagation();
      await removeDuplicateGroup(dupG.dataset.glyphRemoveDupGroup);
      return;
    }
    const flowModeBtn = e.target.closest('[data-flow-mode]');
    if (flowModeBtn) {
      flowMode = flowModeBtn.dataset.flowMode;
      if (FLOW_MODES.includes(flowMode)) {
        state.settings.flowMode = flowMode;
        saveState();
        paintFlowView();
      }
      return;
    }
    const recentRow = e.target.closest('[data-flow-recent]');
    if (recentRow) {
      playById(recentRow.dataset.flowRecent);
      return;
    }
    if (e.target.closest('#btnFlowStart')) {
      e.preventDefault();
      await generateFlowWave(false);
      return;
    }
    if (e.target.closest('#btnFlowPlay')) {
      e.preventDefault();
      playFlowWave();
      return;
    }
    if (e.target.closest('#btnFlowShuffle')) {
      e.preventDefault();
      await generateFlowWave(false);
      return;
    }
  });
}

async function init() {
  if (!api) {
    content.innerHTML = '<div class="empty-state">Run Senza inside Electron (npm run electron:dev:watch)</div>';
    return;
  }
  initDialog();
  await loadState();
  initChromeIcons();
  setIcon('btnShuffle', 'shuffle');
  setIcon('btnRepeat', 'repeat');
  setIcon('btnLyrics', 'lyrics');
  playerChrome = initPlayerChrome(player, audio, () => locale, api, {
    lyricsEnabled: state.settings.lyricsEnabled !== false,
    onLyricsTick: updateLyricsDisplay,
  });
  initHotkeys({
    player,
    audio,
    getLocale: () => locale,
    onToggleFavorite: toggleFavorite,
    getCurrentTrack: () => {
      const q = player.getQueue();
      return q[player.getIndex()] || null;
    },
  });
  if (state.settings.watchedFolder && api.watchedFolderStart) {
    api.watchedFolderStart(state.settings.watchedFolder).catch(() => {});
  }
  api.onWatchedImport?.((result) => {
    afterImport(result);
  });
  applyAccentColor(state.settings.accentColor);
  applyI18n(locale);
  await updateProfileChrome();
  buildSidebar();
  applyTagEditorGlyphUi();
  bindContentActions();
  setView('flow');
  document.addEventListener('visibilitychange', () => {
    lastUsageTick = Date.now();
  });
  setInterval(() => {
    tickUsageMs();
    saveState();
  }, 60000);

  if (state.queue?.length) {
    const qTracks = state.queue.map((id) => state.tracks.find((tr) => tr.id === id)).filter(Boolean);
    if (qTracks.length) {
      const idx = Math.min(state.queueIndex || 0, qTracks.length - 1);
      player.setQueue(qTracks, idx);
    }
  }
}

init();

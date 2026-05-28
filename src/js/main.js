import { detectLocale, applyI18n, t, tf } from './i18n.js';
import { randomDisplayName, randomProfileSeed, drawIdenticon, identiconToDataUrl } from './profile.js';
import { filterTracks, sortAlbumTracks } from './library.js';
import { createPlayer } from './player.js';
import { initPlayerChrome } from './player-chrome.js';
import { suggestFromFilename, suggestFromTags } from './metadata-assistant.js';
import { openCoverCropModal } from './cover-crop.js';
import { formatArtistsDisplay } from './artists.js';
import { logPlay } from './journal.js';
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
  renderTrackRow,
  renderLibraryTreeHtml,
} from './views.js';

const api = window.senza;

let state = {
  tracks: [],
  queue: [],
  queueIndex: 0,
  playlists: [],
  playHistory: [],
  settings: { theme: 'dark', locale: 'en', collectionMode: false, volume: 0.85, clickLock: false },
};
let locale = detectLocale();
let currentView = 'tracks';
let settingsSection = 'appearance';
let albumFocus = null;
let lastLoggedTrackId = null;
let playlistPickerTrackId = null;
let contextMenuTrackId = null;
let searchQuery = '';
let editingTrackId = null;
let pendingCover = null;
let pendingProfileAvatar = null;
let lastSuggestion = null;
let libraryRoot = '';

const content = document.getElementById('content');
const sidebarNav = document.getElementById('sidebarNav');
const audio = document.getElementById('audio');
const queuePanel = document.getElementById('queuePanel');
const queueList = document.getElementById('queueList');
const tagEditor = document.getElementById('tagEditor');

let playerChrome;

const player = createPlayer(
  audio,
  (status) => {
    if (status.track?.id && status.playing && status.track.id !== lastLoggedTrackId) {
      logPlay(state, status.track);
      lastLoggedTrackId = status.track.id;
    }
    if (!status.playing && !status.track) lastLoggedTrackId = null;
    playerChrome?.onPlaybackUpdate(status.track, status.playing);
    renderQueue(status.queue, status.index);
    persistPlayback(status.queue, status.index);
  },
  (p) => api.fileUrl(p)
);

function persistPlayback(queue, index) {
  state.queue = queue.map((t) => t.id);
  state.queueIndex = index;
  api.saveState(state);
}

async function afterImport(result) {
  await loadState();
  const parts = [];
  if (result?.added?.length) {
    parts.push(t('import.done', locale).replace('{n}', String(result.added.length)));
  }
  if (result?.skipped?.length) {
    parts.push(t('import.skipped', locale).replace('{n}', String(result.skipped.length)));
  }
  if (parts.length) alert(parts.join('\n'));
  setView('tracks');
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
        alert(t('playlists.added', locale));
        if (currentView === 'playlists') setView('playlists');
      });
    });
  }
  picker.classList.remove('hidden');
  applyI18n(locale);
}

function openAlbumFocus(artist, album) {
  albumFocus = { artist, album };
  setView('album');
}

async function loadState() {
  state = await api.getState();
  if (!state.tracks) state.tracks = [];
  if (!state.queue) state.queue = [];
  if (state.queueIndex === undefined) state.queueIndex = 0;
  if (!state.settings) state.settings = { theme: 'dark', collectionMode: false, volume: 0.85, clickLock: false };
  if (state.settings.clickLock === undefined) state.settings.clickLock = false;
  if (!state.playHistory) state.playHistory = [];
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
}

async function saveState() {
  state.settings.locale = locale;
  await api.saveState(state);
}

function buildSidebar() {
  const items = [
    { id: 'tracks', key: 'nav.tracks', icon: 'tracks' },
    { id: 'albums', key: 'nav.albums', icon: 'albums' },
    { id: 'artists', key: 'nav.artists', icon: 'artists' },
    { id: 'playlists', key: 'nav.playlists', icon: 'playlists' },
  ];
  sidebarNav.innerHTML = items
    .map(
      (item) => `
    <button type="button" class="nav-item${currentView === item.id ? ' active' : ''}" data-view="${item.id}">
      <span class="nav-icon icon-host" data-icon="${item.icon}"></span>
      <span data-i18n="${item.key}">${t(item.key, locale)}</span>
    </button>`
    )
    .join('');
  sidebarNav.querySelectorAll('[data-icon]').forEach((el) => setIcon(el, el.dataset.icon));
  document.querySelectorAll('.sidebar-footer [data-icon]').forEach((el) => setIcon(el, el.dataset.icon));
}

function getFilteredTracks() {
  return filterTracks(state.tracks, searchQuery);
}

function playById(id) {
  const tracks = getFilteredTracks();
  const idx = tracks.findIndex((tr) => tr.id === id);
  if (idx >= 0) player.playTrack(tracks[idx], tracks, idx);
}

function openTagEditor(trackId) {
  const track = state.tracks.find((tr) => tr.id === trackId);
  if (!track) return;
  editingTrackId = trackId;
  pendingCover = null;
  document.getElementById('tagTitle').value = track.title || '';
  document.getElementById('tagArtist').value = track.artist || '';
  document.getElementById('tagAlbum').value = track.album || '';
  document.getElementById('tagGenre').value = track.genre || '';
  document.getElementById('tagYear').value = track.year || '';
  document.getElementById('tagTrackNo').value = track.trackNo || '';
  const fromFile = suggestFromFilename(track.path);
  const fromTags = track.artist ? suggestFromTags(track) : null;
  showSuggestion(fromFile.artist ? fromFile : fromTags || fromFile);
  tagEditor.classList.remove('hidden');
  refreshTagCoverPreview(track);
}

function applySuggestionToForm(suggestion) {
  document.getElementById('tagTitle').value = suggestion.title || '';
  document.getElementById('tagArtist').value = suggestion.artist || '';
  document.getElementById('tagAlbum').value = suggestion.album || '';
  document.getElementById('tagGenre').value = suggestion.genre || '';
  document.getElementById('tagYear').value = suggestion.year || '';
  document.getElementById('tagTrackNo').value = suggestion.trackNo || '';
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

function showSuggestion(suggestion) {
  lastSuggestion = suggestion;
  const el = document.getElementById('tagAssistant');
  const artistsLine =
    suggestion.artists?.length > 1
      ? `<br>${t('tags.artists', locale)}: <strong>${suggestion.artists.join(', ')}</strong>`
      : '';
  if (suggestion.confidence.level === 'low' && !suggestion.artist) {
    el.innerHTML = `<span>${t('tags.suggest', locale)}: cleaned filename → <strong>${suggestion.title}</strong></span>${artistsLine}`;
    return;
  }
  el.innerHTML = `
    <strong>${t('tags.assistantTitle', locale)}</strong> (${suggestion.confidence.level} ${t('tags.confidence', locale)})<br>
    ${suggestion.artist ? `${formatArtistsDisplay(suggestion.artist)} — ` : ''}<strong>${suggestion.title}</strong>
    ${suggestion.album ? `<br>${suggestion.album}` : ''}
    ${suggestion.year ? ` · ${suggestion.year}` : ''}
    ${artistsLine}
    <br><button type="button" class="btn" style="margin-top:8px" id="applySuggestion">${t('tags.applySuggest', locale)}</button>`;
  document.getElementById('applySuggestion')?.addEventListener('click', () => applySuggestionToForm(suggestion));
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
      playById(row.dataset.id);
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
  content.querySelector('[data-capsule-play]')?.addEventListener('click', (e) => {
    playById(e.currentTarget.dataset.capsulePlay);
  });
  content.querySelectorAll('.journal-row[data-id]').forEach((row) => {
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
  content.querySelectorAll('.card[data-artist]').forEach((card) => {
    card.addEventListener('click', () => {
      const artistTracks = state.tracks.filter((tr) => tr.artist === card.dataset.artist);
      if (artistTracks.length) player.playTrack(artistTracks[0], artistTracks, 0);
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
    if (!picked?.coverPath) return;
    const bytes = await api.readFileBinary(picked.coverPath);
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
  if (view !== 'album') albumFocus = null;
  currentView = view;
  buildSidebar();
  document.querySelectorAll('.sidebar-footer .nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  const tracks = getFilteredTracks();
  const collectionMode = state.settings.collectionMode;

  switch (view) {
    case 'albums':
      content.innerHTML = renderAlbumsView(tracks, locale, collectionMode);
      break;
    case 'collection':
      content.innerHTML = renderCollectionView(tracks, locale);
      break;
    case 'artists':
      content.innerHTML = renderArtistsView(tracks, locale);
      break;
    case 'playlists':
      content.innerHTML = renderPlaylistsView(state.playlists, locale);
      bindPlaylists();
      break;
    case 'vault':
      content.innerHTML = renderVaultView(state.tracks, locale);
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
        state.tracks
      );
      bindSettings();
      if (settingsSection === 'library') bindLibraryTree();
      if (settingsSection === 'profile') bindProfileSettings();
      break;
    default:
      content.classList.remove('content--settings');
      content.innerHTML = renderTracksView(tracks, locale);
  }
  if (view !== 'settings') content.classList.remove('content--settings');
  bindTrackRows();
  applyI18n(locale);
}

function renderQueue(queue, currentIndex) {
  queueList.innerHTML = queue
    .map(
      (tr, i) => `
    <li data-idx="${i}" draggable="true" class="${i === currentIndex ? 'active' : ''}">
      <strong>${tr.title}</strong><br><span style="color:var(--text-muted)">${tr.artist}</span>
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

document.getElementById('btnPlay').addEventListener('click', () => player.toggle());
document.getElementById('btnNext').addEventListener('click', () => player.next());
document.getElementById('btnPrev').addEventListener('click', () => player.prev());
document.getElementById('btnQueue').addEventListener('click', () => queuePanel.classList.toggle('hidden'));
document.getElementById('queueClose').addEventListener('click', () => queuePanel.classList.add('hidden'));
document.getElementById('volume').addEventListener('input', (e) => {
  audio.volume = Number(e.target.value);
  state.settings.volume = audio.volume;
  saveState();
});

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value;
  if (['tracks', 'albums', 'artists', 'collection', 'album'].includes(currentView)) setView(currentView);
});

sidebarNav.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (btn) setView(btn.dataset.view);
});

document.querySelector('.sidebar-footer').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (btn) setView(btn.dataset.view);
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

document.getElementById('tagSuggest').addEventListener('click', () => {
  const track = state.tracks.find((tr) => tr.id === editingTrackId);
  if (track) showSuggestion(suggestFromFilename(track.path));
});

async function openCoverPickerForTags() {
  const picked = await api.pickCover();
  if (picked?.coverPath) {
    const bytes = await api.readFileBinary(picked.coverPath);
    if (bytes?.length) {
      openCoverCropModal(new Blob([new Uint8Array(bytes)]), locale, onCoverCropped);
      return;
    }
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
    const updated = await api.writeTags({ trackId: editingTrackId, tags });
    const idx = state.tracks.findIndex((tr) => tr.id === editingTrackId);
    if (idx >= 0) state.tracks[idx] = { ...state.tracks[idx], ...updated };
    pendingCover = null;
    await saveState();
    tagEditor.classList.add('hidden');
    editingTrackId = null;
    const playing = player.getQueue()[player.getIndex()];
    if (playing) playerChrome?.refreshArtwork(playing);
    setView(currentView);
  } catch (err) {
    alert(err.message || String(err));
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

async function init() {
  if (!api) {
    content.innerHTML = '<div class="empty-state">Run Senza inside Electron (npm run electron:dev:watch)</div>';
    return;
  }
  await loadState();
  initChromeIcons();
  playerChrome = initPlayerChrome(player, audio, () => locale, api);
  applyI18n(locale);
  await updateProfileChrome();
  buildSidebar();
  setView('tracks');

  if (state.queue?.length) {
    const qTracks = state.queue.map((id) => state.tracks.find((tr) => tr.id === id)).filter(Boolean);
    if (qTracks.length) {
      const idx = Math.min(state.queueIndex || 0, qTracks.length - 1);
      player.setQueue(qTracks, idx);
    }
  }
}

init();

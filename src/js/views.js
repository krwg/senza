import { uniqueAlbums, uniqueArtists, computeVault, formatDuration, sortAlbumTracks } from './library.js';
import { journalStats } from './journal.js';
import { t, tf } from './i18n.js';
import { icon } from './icons.js';
import { RELEASE, formatVersionLine } from './release.js';
import { renderSettingsNavHtml } from './settings-nav.js';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function renderTrackRow(tr, index, locale, extraActions = '') {
  return `
    <div class="track-row" data-id="${tr.id}">
      <span class="idx">${index + 1}</span>
      <span class="track-row-title">${esc(tr.title)}</span>
      <span class="track-row-artist">${esc(tr.artist)}</span>
      <span class="row-actions">
        <span class="track-row-dur">${formatDuration(tr.duration)}</span>
        <button type="button" class="btn btn-icon icon-host" data-add-playlist="${tr.id}" title="${t('playlists.add', locale)}" aria-label="${t('playlists.add', locale)}" data-icon="plus"></button>
        <button type="button" class="btn btn-tag" data-edit-tags="${tr.id}">${t('tags.edit', locale)}</button>
        ${extraActions}
      </span>
    </div>`;
}

export function renderTracksView(tracks, locale) {
  if (!tracks.length) {
    return `<div class="empty-state">${t('empty.tracks', locale)}</div>`;
  }
  const rows = tracks.map((tr, i) => renderTrackRow(tr, i, locale)).join('');

  return `
    <div class="view-head"><h1>${t('nav.tracks', locale)}</h1><p>${tf('view.tracksCount', locale, { n: tracks.length })}</p></div>
    <div class="track-list">${rows}</div>`;
}

export function renderAlbumsView(tracks, locale, collectionMode) {
  const albums = uniqueAlbums(tracks);
  const gridClass = collectionMode ? 'grid-cards collection' : 'grid-cards';
  const cards = albums
    .map(
      (a) => `
    <div class="card" data-album="${esc(a.artist)}::${esc(a.album)}">
      <div class="card-art">${icon('album', 'icon-xl')}</div>
      <div class="card-title">${esc(a.album)}</div>
      <div class="card-sub">${esc(a.artist)} · ${tf('view.tracksCount', locale, { n: a.tracks.length })}</div>
    </div>`
    )
    .join('');

  return `
    <div class="view-head"><h1>${t('nav.albums', locale)}</h1><p>${tf('view.albumsCount', locale, { n: albums.length })}</p></div>
    <div class="${gridClass}">${cards || `<div class="empty-state">${t('empty.tracks', locale)}</div>`}</div>`;
}

export function renderAlbumDetailView(artist, album, tracks, locale) {
  const sorted = sortAlbumTracks(tracks);
  const rows = sorted.map((tr, i) => renderTrackRow(tr, i, locale)).join('');
  return `
    <button type="button" class="album-back btn" id="albumBack">
      <span class="icon-host" data-icon="chevronLeft"></span>
      <span data-i18n="album.back">${t('album.back', locale)}</span>
    </button>
    <div class="album-focus">
      <div class="album-focus-art">${icon('album', 'icon-xl')}</div>
      <div class="album-focus-meta">
        <p class="album-focus-label">${t('nav.albums', locale)}</p>
        <h1 class="album-focus-title">${esc(album)}</h1>
        <p class="album-focus-artist">${esc(artist)}</p>
        <p class="album-focus-count">${sorted.length} ${t('album.tracks', locale)}</p>
        <button type="button" class="btn btn-primary" id="playAlbumFocus" data-i18n="album.play">${t('album.play', locale)}</button>
      </div>
    </div>
    <div class="track-list album-track-list">${rows}</div>`;
}

export function renderJournalView(history, tracks, locale, opts = {}) {
  const embedded = Boolean(opts.embedded);
  const byId = new Map(tracks.map((tr) => [tr.id, tr]));
  const stats = journalStats(history, byId, t('meta.unknownArtist', locale));
  const head = embedded
    ? ''
    : `
      <div class="view-head">
        <h1 data-i18n="journal.title">${t('journal.title', locale)}</h1>
        <p data-i18n="journal.sub">${t('journal.sub', locale)}</p>
      </div>`;

  if (!stats.recent.length) {
    return `
      ${head}
      <div class="empty-state" data-i18n="journal.empty">${t('journal.empty', locale)}</div>`;
  }

  const capsuleBlock = stats.timeCapsule
    ? `
    <div class="journal-capsule">
      <h3 data-i18n="capsule.title">${t('capsule.title', locale)}</h3>
      <p class="journal-capsule-text">${esc(stats.timeCapsule.title || '—')} — ${esc(stats.timeCapsule.artist || '')}</p>
      <button type="button" class="btn" data-capsule-play="${stats.timeCapsule.trackId}" data-i18n="capsule.play">${t('capsule.play', locale)}</button>
    </div>`
    : '';

  const top = stats.topArtists
    .map(
      (a) => `
    <div class="journal-top-row">
      <span>${esc(a.name)}</span>
      <span class="journal-top-plays">${a.plays}</span>
    </div>`
    )
    .join('');

  const recent = stats.recent
    .map((e) => {
      const tr = byId.get(e.trackId);
      const title = tr?.title || e.title || '—';
      const artist = tr?.artist || e.artist || '—';
      const when = new Date(e.playedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `
      <div class="journal-row" data-id="${e.trackId}">
        <div>
          <div class="journal-row-title">${esc(title)}</div>
          <div class="journal-row-artist">${esc(artist)}</div>
        </div>
        <time class="journal-row-time">${when}</time>
      </div>`;
    })
    .join('');

  return `
    ${head}
    ${capsuleBlock}
    <div class="journal-stats">
      <div class="stat-box"><div class="stat-value">${stats.weekPlays}</div><div class="stat-label" data-i18n="journal.week">${t('journal.week', locale)}</div></div>
      <div class="stat-box"><div class="stat-value">${stats.totalPlays}</div><div class="stat-label" data-i18n="journal.total">${t('journal.total', locale)}</div></div>
    </div>
    <div class="journal-section">
      <h3 data-i18n="journal.top">${t('journal.top', locale)}</h3>
      <div class="journal-top-list">${top || `<p class="empty-state" style="padding:12px">—</p>`}</div>
    </div>
    <div class="journal-section">
      <h3 data-i18n="journal.recent">${t('journal.recent', locale)}</h3>
      <div class="journal-recent-list">${recent}</div>
    </div>`;
}

export function renderCollectionView(tracks, locale) {
  return renderAlbumsView(tracks, locale, true).replace(
    `<h1>${t('nav.albums', locale)}</h1>`,
    `<h1>${t('collection.title', locale)}</h1>`
  ).replace(
    /<p>\d+ albums<\/p>/,
    `<p>${t('collection.sub', locale)}</p>`
  );
}

export function renderArtistsView(tracks, locale) {
  const artists = uniqueArtists(tracks);
  const cards = artists
    .map(
      (a) => `
    <div class="card" data-artist="${esc(a.name)}">
      <div class="card-art">${icon('artist', 'icon-xl')}</div>
      <div class="card-title">${esc(a.name)}</div>
      <div class="card-sub">${tf('view.tracksCount', locale, { n: a.tracks.length })}</div>
    </div>`
    )
    .join('');

  return `
    <div class="view-head"><h1>${t('nav.artists', locale)}</h1><p>${tf('view.artistsCount', locale, { n: artists.length })}</p></div>
    <div class="grid-cards">${cards || `<div class="empty-state">${t('empty.tracks', locale)}</div>`}</div>`;
}

export function renderPlaylistsView(playlists, locale) {
  const items = playlists
    .map(
      (p) => `
    <div class="playlist-item" data-playlist="${p.slug}">
      <div>
        <strong>${esc(p.name)}</strong><br>
        <span style="color:var(--text-muted);font-size:10px">${tf('view.playlistTracks', locale, { n: p.trackIds?.length || 0 })} · ${t('playlists.pathHint', locale).replace('{slug}', esc(p.slug))}</span>
      </div>
      <button type="button" class="btn icon-host" data-delete-playlist="${p.slug}" data-icon="close" aria-label="Delete"></button>
    </div>`
    )
    .join('');

  return `
    <div class="view-head">
      <h1>${t('playlists.title', locale)}</h1>
      <p>${t('playlists.sub', locale)}</p>
    </div>
    <div class="playlist-create">
      <input type="text" id="playlistNameInput" placeholder="${t('playlists.newPlaceholder', locale)}">
      <button type="button" class="btn btn-primary" id="btnCreatePlaylist">${t('playlists.create', locale)}</button>
    </div>
    <div id="playlistList">${items || `<div class="empty-state">${t('playlists.empty', locale)}</div>`}</div>
    <div id="playlistDetail" class="hidden"></div>`;
}

export function renderVaultView(tracks, locale) {
  const v = computeVault(tracks);
  return `
    <div class="view-head">
      <h1>${t('vault.title', locale)}</h1>
      <p>${t('vault.sub', locale)}</p>
    </div>
    <div class="health-score">${v.score}/100</div>
    <p style="color:var(--text-muted);margin-bottom:20px">${t('vault.score', locale)}</p>
    <div class="vault-stats">
      <div class="stat-box"><div class="stat-value">${v.total}</div><div class="stat-label">${t('vault.tracks', locale)}</div></div>
      <div class="stat-box"><div class="stat-value">${v.artists}</div><div class="stat-label">${t('vault.artists', locale)}</div></div>
      <div class="stat-box"><div class="stat-value">${v.albums}</div><div class="stat-label">${t('vault.albums', locale)}</div></div>
      <div class="stat-box"><div class="stat-value">${v.coverPct}%</div><div class="stat-label">${t('vault.covers', locale)}</div></div>
      <div class="stat-box"><div class="stat-value">${v.tagPct}%</div><div class="stat-label">${t('vault.tagsOk', locale)}</div></div>
      <div class="stat-box"><div class="stat-value">${v.needsAttention}</div><div class="stat-label">${t('vault.needAttention', locale)}</div></div>
    </div>`;
}

export function renderImportView(locale) {
  return `
    <div class="view-head">
      <h1>${t('import.title', locale)}</h1>
      <p>${t('import.sub', locale)}</p>
    </div>
    <div class="import-zone" id="importZone">
      <p>${t('import.drop', locale)}</p>
    </div>
    <div class="import-actions">
      <button type="button" class="btn btn-primary" id="btnPickFiles">${t('import.files', locale)}</button>
      <button type="button" class="btn" id="btnPickFolder">${t('import.folder', locale)}</button>
    </div>`;
}

function settingsPanel(section, activeSection, body) {
  const hidden = section !== activeSection ? ' hidden' : '';
  return `<section class="settings-panel${hidden}" data-settings-panel="${section}">${body}</section>`;
}

export function renderLibraryTreeHtml(node, depth = 0) {
  if (!node) return '';
  const pad = 8 + depth * 14;
  if (node.type === 'file') {
    return `<div class="library-tree-row library-tree-file" style="padding-left:${pad}px">${esc(node.name)}</div>`;
  }
  const kids = (node.children || []).map((c) => renderLibraryTreeHtml(c, depth + 1)).join('');
  return `
    <div class="library-tree-row library-tree-folder" style="padding-left:${pad}px">${esc(node.name)}</div>
    ${kids}`;
}

export function renderSettingsView(locale, settings, libraryRoot, activeSection = 'appearance', playHistory = [], tracks = []) {
  const versionLine = formatVersionLine(locale);
  const nav = renderSettingsNavHtml(locale, activeSection);

  const appearancePanel = settingsPanel(
    'appearance',
    activeSection,
    `
    <h2 class="settings-panel-title" data-i18n="settings.section_appearance">${t('settings.section_appearance', locale)}</h2>
    <p class="settings-panel-desc" data-i18n="settings.section_appearance_desc">${t('settings.section_appearance_desc', locale)}</p>
    <div class="settings-field">
      <label class="settings-field-label" for="settingTheme" data-i18n="settings.theme">${t('settings.theme', locale)}</label>
      <select id="settingTheme" class="settings-select">
        <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>${t('theme.dark', locale)}</option>
        <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>${t('theme.light', locale)}</option>
      </select>
    </div>
    <div class="settings-field">
      <label class="settings-field-label" for="settingLang" data-i18n="settings.language">${t('settings.language', locale)}</label>
      <select id="settingLang" class="settings-select">
        <option value="en" ${locale === 'en' ? 'selected' : ''}>English</option>
        <option value="ru" ${locale === 'ru' ? 'selected' : ''}>Русский</option>
      </select>
    </div>
    <div class="settings-field settings-field-center">
      <label class="settings-toggle">
        <span data-i18n="settings.collection">${t('settings.collection', locale)}</span>
        <input type="checkbox" id="settingCollection" ${settings.collectionMode ? 'checked' : ''}>
      </label>
    </div>`
  );

  const libraryPanel = settingsPanel(
    'library',
    activeSection,
    `
    <h2 class="settings-panel-title" data-i18n="settings.section_library">${t('settings.section_library', locale)}</h2>
    <p class="settings-panel-desc" data-i18n="settings.section_library_desc">${t('settings.section_library_desc', locale)}</p>
    <div class="settings-field">
      <span class="settings-field-label" data-i18n="settings.library">${t('settings.library', locale)}</span>
      <code class="settings-path">${esc(libraryRoot)}</code>
    </div>
    <div class="settings-field settings-field-tree">
      <span class="settings-field-label" data-i18n="library.tree">${t('library.tree', locale)}</span>
      <div class="library-tree" id="libraryTree" data-i18n="library.treeEmpty">${t('library.treeEmpty', locale)}</div>
    </div>`
  );

  const profile = settings.profile || { displayName: 'senza-listener', avatarSeed: 'senza' };
  const profilePanel = settingsPanel(
    'profile',
    activeSection,
    `
    <h2 class="settings-panel-title" data-i18n="settings.section_profile">${t('settings.section_profile', locale)}</h2>
    <p class="settings-panel-desc" data-i18n="settings.section_profile_desc">${t('settings.section_profile_desc', locale)}</p>
    <div class="profile-settings">
      <canvas id="profileAvatarPreview" class="profile-avatar-preview" width="128" height="128"></canvas>
      <div class="settings-field">
        <label class="settings-field-label" for="profileDisplayName" data-i18n="profile.name">${t('profile.name', locale)}</label>
        <input type="text" id="profileDisplayName" class="settings-text-input" maxlength="32" value="${esc(profile.displayName || '')}">
      </div>
      <div class="profile-settings-actions">
        <button type="button" class="btn" id="profileRandomName" data-i18n="profile.randomName">${t('profile.randomName', locale)}</button>
        <button type="button" class="btn" id="profileRandomAvatar" data-i18n="profile.randomAvatar">${t('profile.randomAvatar', locale)}</button>
        <button type="button" class="btn" id="profileUploadAvatar" data-i18n="profile.upload">${t('profile.upload', locale)}</button>
        <button type="button" class="btn btn-primary" id="profileSave" data-i18n="profile.save">${t('profile.save', locale)}</button>
      </div>
    </div>`
  );

  const playbackPanel = settingsPanel(
    'playback',
    activeSection,
    `
    <h2 class="settings-panel-title" data-i18n="settings.section_playback">${t('settings.section_playback', locale)}</h2>
    <p class="settings-panel-desc" data-i18n="settings.section_playback_desc">${t('settings.section_playback_desc', locale)}</p>
    <div class="settings-field settings-field-center">
      <label class="settings-field-label" for="settingVolume" data-i18n="settings.volume">${t('settings.volume', locale)}</label>
      <input type="range" id="settingVolume" class="range-input range-volume settings-volume" min="0" max="1" step="0.01" value="${settings.volume ?? 0.85}">
    </div>
    <div class="settings-field settings-field-center">
      <label class="settings-toggle">
        <span data-i18n="settings.clickLock">${t('settings.clickLock', locale)}</span>
        <input type="checkbox" id="settingClickLock" ${settings.clickLock ? 'checked' : ''}>
      </label>
    </div>`
  );

  const journalPanel = settingsPanel(
    'journal',
    activeSection,
    `<div class="settings-panel-inner settings-panel-inner--journal"><div class="journal-settings-layout">${renderJournalView(playHistory, tracks, locale, { embedded: true })}</div></div>`
  );

  const aboutPanel = settingsPanel(
    'about',
    activeSection,
    `
    <div class="settings-panel-inner settings-panel-inner--about">
      <div class="settings-about-stack">
        <img class="settings-about-icon" src="./icon.svg" width="112" height="112" alt="${esc(RELEASE.name)}">
        <h2 class="settings-about-line">${esc(RELEASE.name)}</h2>
        <p class="settings-about-version">${esc(versionLine)}</p>
        <p class="settings-about-tagline">${esc(RELEASE.description)}</p>
        <div class="settings-about-meta">
          <div class="settings-about-meta-row">
            <span data-i18n="about.license">${t('about.license', locale)}</span>
            <span>GPL-3.0</span>
          </div>
          <div class="settings-about-meta-row">
            <span data-i18n="about.made">${t('about.made', locale)}</span>
            <span>Floke Studio</span>
          </div>
        </div>
        <a class="btn btn-primary settings-about-btn" href="${esc(RELEASE.repository)}" target="_blank" rel="noopener noreferrer" data-i18n="about.github">${t('about.github', locale)}</a>
      </div>
    </div>`
  );

  return `
    <div class="settings-shell">
      <aside class="settings-shell__nav">${nav}</aside>
      <div class="settings-shell__main">
        ${appearancePanel}
        ${libraryPanel}
        ${playbackPanel}
        ${profilePanel}
        ${journalPanel}
        ${aboutPanel}
      </div>
    </div>`;
}

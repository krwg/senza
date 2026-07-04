import {
  uniqueAlbums,
  uniqueArtists,
  computeVault,
  formatDuration,
  sortAlbumTracks,
  sortTracks,
  sortAlbumEntries,
  sortArtistEntries,
  pickAlbumCoverTrack,
  TRACK_SORT_KEYS,
} from './library.js';
import { formatArtistsDisplay, splitArtists, artistSlug } from './artists.js';
import { journalStats, formatMinutes } from './journal.js';
import { t, tf } from './i18n.js';
import { icon } from './icons.js';
import { RELEASE, formatVersionLine } from './release.js';
import { renderSettingsNavHtml } from './settings-nav.js';
import { renderGlyphVaultSection } from './glyph-vault.js';
import { hintButton } from './hint.js';
import { tracksMissingAlbum } from './glyph-album.js';
import { NAV_CATALOG } from './nav-config.js';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function renderSortBar(locale, sortKey, sortDir, keys, idPrefix = 'sort') {
  const options = keys
    .map((k) => {
      const label = t(`sort.${k}`, locale) || k;
      return `<option value="${k}"${k === sortKey ? ' selected' : ''}>${label}</option>`;
    })
    .join('');
  const arrow = sortDir === 'desc' ? '↓' : '↑';
  return `
    <div class="sort-bar">
      <span class="sort-label" data-i18n="sort.label">${t('sort.label', locale)}</span>
      <select class="sort-select" id="${idPrefix}Key" aria-label="${t('sort.label', locale)}">${options}</select>
      <button type="button" class="btn sort-dir-btn" id="${idPrefix}Dir" data-dir="${sortDir}" title="${t('sort.toggle', locale)}">${arrow}</button>
    </div>`;
}

function renderArtistLinks(artistRaw) {
  const names = splitArtists(artistRaw);
  if (!names.length) {
    return `<span class="track-row-artist">${esc(artistRaw || '—')}</span>`;
  }
  const links = names
    .map(
      (name) =>
        `<button type="button" class="artist-link" data-artist-id="${esc(artistSlug(name))}" data-artist-name="${esc(name)}">${esc(name)}</button>`
    )
    .join('<span class="artist-sep">, </span>');
  return `<span class="track-row-artist track-row-artists">${links}</span>`;
}

export function renderTrackRow(tr, index, locale, extraActions = '', rowOpts = {}) {
  const selectCol = rowOpts.selectable
    ? `<label class="track-select-wrap"><input type="checkbox" class="track-select" data-select-track="${tr.id}"${rowOpts.selected ? ' checked' : ''}><span class="sr-only">Select</span></label>`
    : '';
  const favSlot =
    rowOpts.showFavorite !== false
      ? `<button type="button" class="btn btn-icon icon-host track-fav${rowOpts.favorite ? ' track-fav--on' : ''}" data-fav-track="${tr.id}" title="${t('favorites.toggle', locale)}" aria-label="${t('favorites.toggle', locale)}" data-icon="${rowOpts.favorite ? 'heart' : 'heartOutline'}"></button>`
      : `<span class="track-fav-spacer" aria-hidden="true"></span>`;
  return `
    <div class="track-row${rowOpts.selected ? ' track-row--selected' : ''}" data-id="${tr.id}">
      ${selectCol}
      <span class="idx">${index + 1}</span>
      ${favSlot}
      <span class="track-row-title">${esc(tr.title)}</span>
      ${renderArtistLinks(tr.artist)}
      <span class="row-actions">
        <span class="track-row-dur">${formatDuration(tr.duration)}</span>
        <button type="button" class="btn btn-icon icon-host" data-add-playlist="${tr.id}" title="${t('playlists.add', locale)}" aria-label="${t('playlists.add', locale)}" data-icon="plus"></button>
        <button type="button" class="btn btn-tag" data-edit-tags="${tr.id}">${t('tags.edit', locale)}</button>
        ${extraActions}
      </span>
    </div>`;
}

export function renderTracksView(tracks, locale, opts = {}) {
  if (!tracks.length) {
    return `<div class="empty-state">${t('empty.tracks', locale)}</div>`;
  }
  const selected =
    opts.selectedIds instanceof Set ? opts.selectedIds : new Set(opts.selectedIds || []);
  const rowOpts = {
    selectable: Boolean(opts.bulkMode),
    selected: false,
    showFavorite: Boolean(opts.rowOpts?.showFavorite),
    favorite: false,
  };
  const favSet = opts.favoriteIds instanceof Set ? opts.favoriteIds : new Set(opts.favoriteIds || []);
  const sorted = opts.sortKey ? sortTracks(tracks, opts.sortKey, opts.sortDir || 'asc') : tracks;
  const rows = sorted
    .map((tr, i) => {
      rowOpts.selected = selected.has(tr.id);
      rowOpts.favorite = favSet.has(tr.id);
      return renderTrackRow(tr, i, locale, '', rowOpts);
    })
    .join('');
  const title = opts.title || t('nav.tracks', locale);
  const sub = opts.sub || tf('view.tracksCount', locale, { n: tracks.length });
  const back =
    opts.backAction === 'vault'
      ? `<button type="button" class="btn vault-back" id="vaultBack" data-i18n="vault.back">${t('vault.back', locale)}</button>`
      : '';

  const sortBar = opts.showSort
    ? renderSortBar(locale, opts.sortKey || 'title', opts.sortDir || 'asc', opts.sortKeys || TRACK_SORT_KEYS, opts.sortPrefix || 'sort')
    : '';

  const bulkToolbar = opts.showBulk
    ? `
    <div class="tracks-toolbar">
      <button type="button" class="btn" id="btnBulkToggle" data-i18n="${opts.bulkMode ? 'bulk.done' : 'bulk.select'}">${opts.bulkMode ? t('bulk.done', locale) : t('bulk.select', locale)}</button>
      ${
        opts.bulkMode
          ? `<span class="bulk-count" id="bulkCount">${tf('bulk.selected', locale, { n: selected.size })}</span>
      <button type="button" class="btn btn-primary" id="btnBulkEdit"${selected.size ? '' : ' disabled'} data-i18n="bulk.edit">${t('bulk.edit', locale)}</button>
      <button type="button" class="btn" id="btnBulkDelete"${selected.size ? '' : ' disabled'} data-i18n="bulk.delete">${t('bulk.delete', locale)}</button>`
          : ''
      }
    </div>`
    : '';

  return `
    ${back}
    <div class="view-head view-head--split">
      <div><h1>${title}</h1><p>${sub}</p></div>
      <div class="view-head-tools">${sortBar}${bulkToolbar}</div>
    </div>
    <div class="track-list">${rows}</div>`;
}

function albumCardHtml(a, locale) {
  const coverTrack = pickAlbumCoverTrack(a.tracks);
  const coverId = coverTrack?.id || '';
  const sample = coverTrack || a.tracks[0];
  return `
    <div class="card" data-album="${esc(a.artist)}::${esc(a.album)}">
      <div class="card-art" data-cover-track-id="${esc(coverId)}" data-artist="${esc(sample?.artist || '')}" data-album-name="${esc(a.album)}"></div>
      <div class="card-title">${esc(a.album)}</div>
      <div class="card-sub">${esc(formatArtistsDisplay(a.artist))} · ${tf('view.tracksCount', locale, { n: a.tracks.length })}</div>
    </div>`;
}

export function renderAlbumsView(tracks, locale, collectionMode, sortOpts = {}) {
  let albums = uniqueAlbums(tracks);
  if (sortOpts.sortKey) {
    albums = sortAlbumEntries(albums, sortOpts.sortKey, sortOpts.sortDir || 'asc');
  }
  const gridClass = collectionMode ? 'grid-cards collection' : 'grid-cards';
  const cards = albums.map((a) => albumCardHtml(a, locale)).join('');

  const sortBar = sortOpts.showSort
    ? renderSortBar(locale, sortOpts.sortKey || 'album', sortOpts.sortDir || 'asc', ['album', 'artist', 'tracks'], 'sortAlbums')
    : '';
  return `
    <div class="view-head view-head--split">
      <div><h1>${t('nav.albums', locale)}</h1><p>${tf('view.albumsCount', locale, { n: albums.length })}</p></div>
      ${sortBar ? `<div class="view-head-tools">${sortBar}</div>` : ''}
    </div>
    <div class="${gridClass}">${cards || `<div class="empty-state">${t('empty.tracks', locale)}</div>`}</div>`;
}

export function renderAlbumDetailView(artist, album, tracks, locale) {
  const sorted = sortAlbumTracks(tracks);
  const rows = sorted.map((tr, i) => renderTrackRow(tr, i, locale)).join('');
  const coverTrack = pickAlbumCoverTrack(sorted);
  const coverId = coverTrack?.id || '';
  return `
    <button type="button" class="album-back btn" id="albumBack">
      <span class="icon-host" data-icon="chevronLeft"></span>
      <span data-i18n="album.back">${t('album.back', locale)}</span>
    </button>
    <div class="album-focus">
      <div class="album-focus-art" data-cover-track-id="${esc(coverId)}" data-artist="${esc(artist)}" data-album-name="${esc(album)}"></div>
      <div class="album-focus-meta">
        <p class="album-focus-label">${t('nav.albums', locale)}</p>
        <h1 class="album-focus-title">${esc(album)}</h1>
        <p class="album-focus-artist">${esc(formatArtistsDisplay(artist))}</p>
        <p class="album-focus-count">${sorted.length} ${t('album.tracks', locale)}</p>
        <button type="button" class="btn btn-primary" id="playAlbumFocus" data-i18n="album.play">${t('album.play', locale)}</button>
      </div>
    </div>
    <div class="track-list album-track-list">${rows}</div>`;
}

export function renderJournalView(history, tracks, locale, opts = {}) {
  const embedded = Boolean(opts.embedded);
  const usageMs = opts.usageMs ?? 0;
  const byId = new Map(tracks.map((tr) => [tr.id, tr]));
  const stats = journalStats(history, byId, t('meta.unknownArtist', locale), usageMs);
  const head = embedded
    ? ''
    : `
      <div class="view-head">
        <h1 data-i18n="journal.title">${t('journal.title', locale)}</h1>
        <p data-i18n="journal.sub">${t('journal.sub', locale)}</p>
      </div>`;

  const usageLabel = formatMinutes(stats.usageMs, locale);
  const listeningLabel = formatMinutes(stats.listeningMs, locale);

  if (!stats.recent.length && !stats.totalPlays && !stats.usageMs) {
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

  const topArtists = stats.topArtists
    .map(
      (a) => `
    <div class="journal-top-row">
      <span>${esc(a.name)}</span>
      <span class="journal-top-plays">${a.plays}</span>
    </div>`
    )
    .join('');

  const topTracks = stats.topTracks
    .map(
      (row) => `
    <div class="journal-top-row journal-top-row--track" data-id="${esc(row.trackId || '')}">
      <div class="journal-top-track-meta">
        <span class="journal-top-track-title">${esc(row.title)}</span>
        <span class="journal-top-track-artist">${esc(formatArtistsDisplay(row.artist))}</span>
      </div>
      <span class="journal-top-plays">${row.plays}</span>
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
          <div class="journal-row-artist">${esc(formatArtistsDisplay(artist))}</div>
        </div>
        <time class="journal-row-time">${when}</time>
      </div>`;
    })
    .join('');

  return `
    ${head}
    ${capsuleBlock}
    <div class="journal-stats">
      <div class="stat-box"><div class="stat-value">${usageLabel}</div><div class="stat-label" data-i18n="journal.usage">${t('journal.usage', locale)}</div></div>
      <div class="stat-box"><div class="stat-value">${listeningLabel}</div><div class="stat-label" data-i18n="journal.listening">${t('journal.listening', locale)}</div></div>
      <div class="stat-box"><div class="stat-value">${stats.weekPlays}</div><div class="stat-label" data-i18n="journal.week">${t('journal.week', locale)}</div></div>
      <div class="stat-box"><div class="stat-value">${stats.totalPlays}</div><div class="stat-label" data-i18n="journal.total">${t('journal.total', locale)}</div></div>
    </div>
    <div class="journal-section">
      <h3 data-i18n="journal.top">${t('journal.top', locale)}</h3>
      <div class="journal-top-list">${topArtists || `<p class="journal-empty-line">—</p>`}</div>
    </div>
    <div class="journal-section">
      <h3 data-i18n="journal.topTracks">${t('journal.topTracks', locale)}</h3>
      <div class="journal-top-list">${topTracks || `<p class="journal-empty-line">—</p>`}</div>
    </div>
    <div class="journal-section">
      <h3 data-i18n="journal.recent">${t('journal.recent', locale)}</h3>
      <div class="journal-recent-list">${recent}</div>
    </div>`;
}

export function renderCollectionView(tracks, locale) {
  const albums = uniqueAlbums(tracks);
  const cards = albums.map((a) => albumCardHtml(a, locale)).join('');
  return `
    <div class="view-head">
      <h1>${t('collection.title', locale)}</h1>
      <p>${t('collection.sub', locale)} · ${tf('view.albumsCount', locale, { n: albums.length })}</p>
    </div>
    <div class="grid-cards collection">${cards || `<div class="empty-state">${t('empty.tracks', locale)}</div>`}</div>`;
}

export function renderArtistsView(tracks, locale, sortOpts = {}) {
  let artists = uniqueArtists(tracks);
  if (sortOpts.sortKey) {
    artists = sortArtistEntries(artists, sortOpts.sortKey, sortOpts.sortDir || 'asc');
  }
  const cards = artists
    .map(
      (a) => `
    <div class="card" data-artist-id="${esc(a.id)}" data-artist-name="${esc(a.name)}">
      <div class="card-art card-art--artist artist-portrait" data-artist-slug="${esc(a.id)}" data-artist-name="${esc(a.name)}"></div>
      <div class="card-title">${esc(a.name)}</div>
      <div class="card-sub">${tf('view.tracksCount', locale, { n: a.tracks.length })}</div>
    </div>`
    )
    .join('');

  const sortBar = sortOpts.showSort
    ? renderSortBar(locale, sortOpts.sortKey || 'name', sortOpts.sortDir || 'asc', ['name', 'tracks'], 'sortArtists')
    : '';
  return `
    <div class="view-head view-head--split">
      <div><h1>${t('nav.artists', locale)}</h1><p>${tf('view.artistsCount', locale, { n: artists.length })}</p></div>
      ${sortBar ? `<div class="view-head-tools">${sortBar}</div>` : ''}
    </div>
    <div class="grid-cards grid-cards--artists">${cards || `<div class="empty-state">${t('empty.tracks', locale)}</div>`}</div>`;
}

export function renderArtistDetailView(artistId, name, tracks, locale) {
  const sorted = sortAlbumTracks(tracks);
  const rows = sorted.map((tr, i) => renderTrackRow(tr, i, locale)).join('');
  return `
    <button type="button" class="album-back btn" id="artistBack">
      <span class="icon-host" data-icon="chevronLeft"></span>
      <span data-i18n="artist.back">${t('artist.back', locale)}</span>
    </button>
    <div class="artist-focus">
      <button type="button" class="artist-focus-portrait artist-portrait" data-artist-slug="${esc(artistId)}" data-artist-name="${esc(name)}" id="artistPortraitBtn" title="${t('artist.photo', locale)}">
        <span class="artist-portrait-edit" data-i18n="artist.photo">${t('artist.photo', locale)}</span>
      </button>
      <div class="artist-focus-meta">
        <p class="album-focus-label">${t('nav.artists', locale)}</p>
        <h1 class="artist-focus-title">${esc(name)}</h1>
        <p class="artist-focus-count">${sorted.length} ${t('artist.tracks', locale)}</p>
        <div class="artist-focus-actions">
          <button type="button" class="btn" id="artistPhotoBtn" data-i18n="artist.changePhoto">${t('artist.changePhoto', locale)}</button>
          <button type="button" class="btn btn-primary" id="playArtistFocus" data-i18n="artist.play">${t('artist.play', locale)}</button>
        </div>
        <p class="artist-photo-hint" data-i18n="artist.photoHint">${t('artist.photoHint', locale)}</p>
      </div>
    </div>
    <div class="track-list album-track-list">${rows}</div>`;
}

export function renderPlaylistsView(playlists, locale, smartPlaylists = []) {
  const smartItems = smartPlaylists
    .map(
      (p) => `
    <div class="playlist-item playlist-item--smart" data-smart-playlist="${p.id}">
      <div>
        <strong>${esc(p.name)}</strong><br>
        <span style="color:var(--text-muted);font-size:10px">${t('playlists.smartHint', locale)}</span>
      </div>
    </div>`
    )
    .join('');

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
    ${smartItems ? `<div class="playlist-smart-section"><h3 class="playlist-smart-title">${t('playlists.smartTitle', locale)}</h3>${smartItems}</div>` : ''}
    <div id="playlistList">${items || `<div class="empty-state">${t('playlists.empty', locale)}</div>`}</div>
    <div id="playlistDetail" class="hidden"></div>`;
}

function vaultAttentionRow(tr, locale, reasonKey) {
  return `
    <div class="vault-attention-row" data-id="${tr.id}">
      <div class="vault-attention-meta">
        <div class="vault-attention-title">${esc(tr.title || '—')}</div>
        <div class="vault-attention-sub">${esc(formatArtistsDisplay(tr.artist || '—'))} · ${esc(tr.album || '—')}</div>
        <div class="vault-attention-reason">${t(reasonKey, locale)}</div>
      </div>
      <button type="button" class="btn btn-tag" data-edit-tags="${tr.id}">${t('tags.edit', locale)}</button>
    </div>`;
}

function vaultAttentionReason(tr) {
  if (!String(tr.title || '').trim()) return 'vault.reason.noTitle';
  const names = splitArtists(tr.artist);
  if (!names.length || names.every((a) => a === 'Unknown Artist')) return 'vault.reason.unknownArtist';
  if (!tr.album || tr.album === 'Unknown Album') return 'vault.reason.unknownAlbum';
  return 'vault.reason.unknownArtist';
}

export function renderVaultView(tracks, locale, detailFilter = null, glyphScan = null, glyphLoading = false, glyphEnabled = true) {
  const v = computeVault(tracks);
  const glyphBlock = renderGlyphVaultSection(glyphScan, locale, glyphLoading, glyphEnabled);
  const stat = (filter, value, label) => {
    if (!filter) {
      return `<div class="stat-box"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
    }
    const active = detailFilter === filter ? ' stat-box--active' : '';
    return `<div class="stat-box stat-box--click${active}" data-vault-filter="${filter}"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  };

  let detailHtml = '';
  if (detailFilter === 'attention' && v.attentionTracks.length) {
    const rows = v.attentionTracks
      .map((tr) => vaultAttentionRow(tr, locale, vaultAttentionReason(tr)))
      .join('');
    detailHtml = `
      <div class="vault-detail">
        <h3 class="vault-detail-title">${t('vault.attentionList', locale)}</h3>
        <div class="vault-attention-list">${rows}</div>
      </div>`;
  } else if (detailFilter === 'attention') {
    detailHtml = `<div class="vault-detail"><p class="empty-state">${t('vault.attentionEmpty', locale)}</p></div>`;
  } else if (detailFilter === 'no-cover' && v.noCoverTracks.length) {
    const rows = v.noCoverTracks.map((tr) => vaultAttentionRow(tr, locale, 'vault.reason.noCover')).join('');
    detailHtml = `
      <div class="vault-detail">
        <h3 class="vault-detail-title">${t('vault.noCoverList', locale)}</h3>
        <div class="vault-attention-list">${rows}</div>
      </div>`;
  } else if (detailFilter === 'no-cover') {
    detailHtml = `<div class="vault-detail"><p class="empty-state">${t('vault.noCoverEmpty', locale)}</p></div>`;
  }

  const missingAlbums = tracksMissingAlbum(tracks).length;

  return `
    <div class="view-head view-head--split">
      <div>
        <h1>${t('vault.title', locale)}</h1>
        <p>${t('vault.sub', locale)}</p>
        ${hintButton('vault.hint', locale)}
      </div>
      <div class="view-head-tools">
        <button type="button" class="btn" id="btnInsightsFixAlbums" ${missingAlbums ? '' : 'disabled'}>${t('vault.fixAlbums', locale)} (${missingAlbums})</button>
      </div>
    </div>
    <div class="vault-hero">
      <div class="health-score">${v.score}<span>/100</span></div>
      <p class="vault-score-label">${t('vault.score', locale)}</p>
    </div>
    <div class="vault-stats">
      ${stat(null, v.total, t('vault.tracks', locale))}
      ${stat(null, v.artists, t('vault.artists', locale))}
      ${stat(null, v.albums, t('vault.albums', locale))}
      ${stat('no-cover', `${v.coverPct}%`, t('vault.covers', locale))}
      ${stat(null, `${v.tagPct}%`, t('vault.tagsOk', locale))}
      ${stat('attention', v.needsAttention, t('vault.needAttention', locale))}
    </div>
    <p class="vault-hint">${t('vault.browseHint', locale)}</p>
    ${glyphBlock}
    ${detailHtml}`;
}

export function renderRecentView(tracks, playHistory, locale, favoriteIds = []) {
  const favSet = favoriteIds instanceof Set ? favoriteIds : new Set(favoriteIds || []);
  const seen = new Set();
  const ordered = [];
  for (let i = (playHistory?.length || 0) - 1; i >= 0; i -= 1) {
    const e = playHistory[i];
    if (seen.has(e.trackId)) continue;
    const tr = tracks.find((t) => t.id === e.trackId);
    if (!tr) continue;
    seen.add(e.trackId);
    ordered.push(tr);
    if (ordered.length >= 50) break;
  }
  if (!ordered.length) {
    return `<div class="empty-state">${t('recent.empty', locale)}</div>`;
  }
  const rows = ordered.map((tr, i) =>
    renderTrackRow(tr, i, locale, '', { showFavorite: true, favorite: favSet.has(tr.id) })
  ).join('');
  return `
    <div class="view-head"><h1>${t('nav.recent', locale)}</h1><p>${t('recent.sub', locale)}</p></div>
    <div class="track-list">${rows}</div>`;
}

export function renderFavoritesView(tracks, favoriteIds, locale) {
  const favSet = favoriteIds instanceof Set ? favoriteIds : new Set(favoriteIds || []);
  const list = tracks.filter((tr) => favSet.has(tr.id));
  if (!list.length) {
    return `<div class="empty-state">${t('favorites.empty', locale)}</div>`;
  }
  const rows = list.map((tr, i) =>
    renderTrackRow(tr, i, locale, '', { showFavorite: true, favorite: true })
  ).join('');
  return `
    <div class="view-head"><h1>${t('nav.favorites', locale)}</h1><p>${tf('favorites.count', locale, { n: list.length })}</p></div>
    <div class="track-list">${rows}</div>`;
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

function renderNavCustomize(locale, navConfig) {
  const orderMap = new Map((navConfig || []).map((c) => [c.id, c]));
  const rows = NAV_CATALOG.map((item, i) => {
    const cfg = orderMap.get(item.id) || { visible: true, order: i };
    const visible = cfg.visible !== false;
    return `
      <div class="nav-custom-row" data-nav-id="${item.id}">
        <label class="nav-custom-check">
          <input type="checkbox" class="nav-custom-visible" data-nav-id="${item.id}" ${visible ? 'checked' : ''}>
          <span data-i18n="${item.key}">${t(item.key, locale)}</span>
        </label>
        <span class="nav-custom-zone">${item.zone === 'footer' ? t('nav.zoneFooter', locale) : t('nav.zoneMain', locale)}</span>
        <span class="nav-custom-actions">
          <button type="button" class="btn btn-icon nav-custom-up" data-nav-id="${item.id}" aria-label="${t('nav.moveUp', locale)}">↑</button>
          <button type="button" class="btn btn-icon nav-custom-down" data-nav-id="${item.id}" aria-label="${t('nav.moveDown', locale)}">↓</button>
        </span>
      </div>`;
  }).join('');
  return `
    <div class="settings-field nav-custom-block">
      <span class="settings-field-label" data-i18n="settings.navCustomize">${t('settings.navCustomize', locale)}</span>
      <p class="settings-field-hint" data-i18n="settings.navCustomizeHint">${t('settings.navCustomizeHint', locale)}</p>
      <div class="nav-custom-list">${rows}</div>
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

export function renderSettingsView(locale, settings, libraryRoot, activeSection = 'appearance', playHistory = [], tracks = [], usage = { totalMs: 0 }) {
  const versionLine = formatVersionLine(locale);
  const nav = renderSettingsNavHtml(locale, activeSection);
  const glyphOn = settings.glyphEnabled !== false;

  const appearancePanel = settingsPanel(
    'appearance',
    activeSection,
    `
    <h2 class="settings-panel-title" data-i18n="settings.section_appearance">${t('settings.section_appearance', locale)}</h2>
    <p class="settings-panel-desc" data-i18n="settings.section_appearance_desc">${t('settings.section_appearance_desc', locale)}</p>
    <div class="settings-field settings-field-row">
      <span class="settings-field-label" data-i18n="settings.theme">${t('settings.theme', locale)} ${hintButton('settings.themeHint', locale)}</span>
      <select id="settingTheme" class="settings-select">
        <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>${t('theme.dark', locale)}</option>
        <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>${t('theme.light', locale)}</option>
      </select>
    </div>
    <div class="settings-field settings-field-row">
      <span class="settings-field-label" data-i18n="settings.language">${t('settings.language', locale)}</span>
      <select id="settingLang" class="settings-select">
        <option value="en" ${locale === 'en' ? 'selected' : ''}>English</option>
        <option value="ru" ${locale === 'ru' ? 'selected' : ''}>Русский</option>
      </select>
    </div>
    <div class="settings-field settings-field-row">
      <span class="settings-field-label" data-i18n="settings.accent">${t('settings.accent', locale)}</span>
      <input type="color" id="settingAccent" class="settings-color-input" value="${settings.accentColor || '#c8a96e'}">
    </div>
    <div class="settings-field settings-field-center">
      <label class="settings-toggle">
        <span data-i18n="settings.collection">${t('settings.collection', locale)} ${hintButton('settings.collectionHint', locale)}</span>
        <input type="checkbox" id="settingCollection" ${settings.collectionMode ? 'checked' : ''}>
      </label>
    </div>
    ${renderNavCustomize(locale, settings.navConfig)}`
  );

  const glyphPanel = settingsPanel(
    'glyph',
    activeSection,
    `
    <h2 class="settings-panel-title">Glyph2.2-O</h2>
    <p class="settings-panel-desc" data-i18n="settings.section_glyph_desc">${t('settings.section_glyph_desc', locale)}</p>
    <div class="settings-field settings-field-center settings-field--glyph-master">
      <label class="settings-toggle">
        <span data-i18n="settings.glyphEnabled">${t('settings.glyphEnabled', locale)} ${hintButton('settings.glyphEnabledHint', locale)}</span>
        <input type="checkbox" id="settingGlyphEnabled" ${glyphOn ? 'checked' : ''}>
      </label>
    </div>
    ${glyphOn ? '' : `<p class="settings-field-hint settings-glyph-off-hint" data-i18n="glyph.disabledHint">${t('glyph.disabledHint', locale)}</p>`}
    <div class="settings-glyph-body${glyphOn ? '' : ' settings-glyph-body--off'}">
    <div class="glyph-mi-status" id="glyphMiStatus"></div>
    <div class="glyph-online-status" id="glyphOnlineStatus"></div>
    <div class="glyph-library-stats" id="glyphLibraryStats"></div>
    <div class="settings-field settings-field-center">
      <label class="settings-toggle">
        <span data-i18n="settings.glyphAutoApply">${t('settings.glyphAutoApply', locale)} ${hintButton('settings.glyphAutoApplyHint', locale)}</span>
        <input type="checkbox" id="settingGlyphAutoApply" ${settings.glyphAutoApplyOnImport !== false ? 'checked' : ''} ${glyphOn ? '' : 'disabled'}>
      </label>
    </div>
    <div class="settings-field settings-field-center">
      <label class="settings-toggle">
        <span data-i18n="settings.glyphUseMB">${t('settings.glyphUseMB', locale)} ${hintButton('settings.glyphUseMBHint', locale)}</span>
        <input type="checkbox" id="settingGlyphUseMB" ${settings.glyphUseMusicBrainz !== false ? 'checked' : ''} ${glyphOn ? '' : 'disabled'}>
      </label>
    </div>
    <div class="library-settings-actions">
      <button type="button" class="btn btn-primary" id="btnGlyphOpenVault" data-i18n="glyph.openVault" ${glyphOn ? '' : 'disabled'}>${t('glyph.openVault', locale)}</button>
    </div>
    <details class="settings-advanced">
      <summary data-i18n="settings.glyphAdvanced">${t('settings.glyphAdvanced', locale)}</summary>
      <div class="settings-field settings-field-center">
        <label class="settings-toggle">
          <span data-i18n="settings.glyphLog">${t('settings.glyphLog', locale)} ${hintButton('settings.glyphLogHint', locale)}</span>
          <input type="checkbox" id="settingGlyphLog" ${settings.glyphLogEnabled !== false ? 'checked' : ''}>
        </label>
      </div>
      <div class="settings-field settings-field-center">
        <label class="settings-toggle">
          <span data-i18n="settings.glyphLearn">${t('settings.glyphLearn', locale)}</span>
          <input type="checkbox" id="settingGlyphLearn" ${settings.glyphLearnEnabled !== false ? 'checked' : ''}>
        </label>
      </div>
      <div class="settings-field settings-field-center">
        <label class="settings-toggle">
          <span data-i18n="settings.glyphLocal">${t('settings.glyphLocal', locale)}</span>
          <input type="checkbox" id="settingGlyphLocal" ${settings.glyphTryLocal ? 'checked' : ''}>
        </label>
      </div>
      <div class="glyph-learn-stats" id="glyphLearnStats">
        <p class="settings-field-hint" data-i18n="glyph.statsLoading">${t('glyph.statsLoading', locale)}</p>
      </div>
      <div class="library-settings-actions">
        <button type="button" class="btn" id="btnGlyphImportExport" data-i18n="glyph.importExport">${t('glyph.importExport', locale)}</button>
        <button type="button" class="btn" id="btnGlyphExport" data-i18n="glyph.export">${t('glyph.export', locale)}</button>
        <button type="button" class="btn" id="btnGlyphExportDataset" data-i18n="glyph.exportDataset">${t('glyph.exportDataset', locale)}</button>
        <button type="button" class="btn" id="btnGlyphOpenExports" data-i18n="glyph.openExports">${t('glyph.openExports', locale)}</button>
      </div>
    </details>
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
    <div class="library-settings-actions">
      <button type="button" class="btn btn-primary" id="btnLibraryExport" data-i18n="library.export">${t('library.export', locale)}</button>
      <button type="button" class="btn" id="btnLibraryImport" data-i18n="library.import">${t('library.import', locale)}</button>
      <button type="button" class="btn" id="btnOpenLibraryFolder" data-i18n="library.openFolder">${t('library.openFolder', locale)}</button>
      <button type="button" class="btn" id="btnRefreshLibraryTree" data-i18n="library.refreshTree">${t('library.refreshTree', locale)}</button>
    </div>
    <div class="settings-field">
      <span class="settings-field-label" data-i18n="library.watchedFolder">${t('library.watchedFolder', locale)}</span>
      <code class="settings-path" id="watchedFolderPath">${esc(settings.watchedFolder || '—')}</code>
    </div>
    <div class="library-settings-actions">
      <button type="button" class="btn" id="btnPickWatchedFolder" data-i18n="library.pickWatched">${t('library.pickWatched', locale)}</button>
      <button type="button" class="btn" id="btnStopWatchedFolder" data-i18n="library.stopWatched">${t('library.stopWatched', locale)}</button>
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
        <span data-i18n="settings.replayGain">${t('settings.replayGain', locale)}</span>
        <input type="checkbox" id="settingReplayGain" ${settings.replayGainEnabled ? 'checked' : ''}>
      </label>
    </div>
    <div class="settings-field settings-field-row">
      <span class="settings-field-label" data-i18n="settings.crossfade">${t('settings.crossfade', locale)}</span>
      <input type="range" id="settingCrossfade" class="range-input settings-volume" min="0" max="8" step="0.5" value="${settings.crossfadeSec ?? 0}">
      <span id="crossfadeLabel">${settings.crossfadeSec ?? 0}s</span>
    </div>
    <div class="settings-field settings-field-center">
      <label class="settings-toggle">
        <span data-i18n="settings.lyrics">${t('settings.lyrics', locale)}</span>
        <input type="checkbox" id="settingLyrics" ${settings.lyricsEnabled !== false ? 'checked' : ''}>
      </label>
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
    `
    <h2 class="settings-panel-title" data-i18n="settings.section_journal">${t('settings.section_journal', locale)}</h2>
    <p class="settings-panel-desc" data-i18n="journal.sub">${t('journal.sub', locale)}</p>
    <div class="settings-panel-inner settings-panel-inner--journal">
      <div class="journal-settings-layout">${renderJournalView(playHistory, tracks, locale, { embedded: true, usageMs: usage?.totalMs ?? 0 })}</div>
    </div>`
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
            <span>krwg</span>
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
        ${glyphPanel}
        ${profilePanel}
        ${journalPanel}
        ${aboutPanel}
      </div>
    </div>`;
}

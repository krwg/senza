const path = require('path');

function isUnderDir(filePath, dir) {
  const rel = path.relative(path.resolve(dir), path.resolve(filePath));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

const TRACK_KEYS = new Set([
  'id',
  'path',
  'sourcePath',
  'title',
  'artist',
  'album',
  'genre',
  'year',
  'trackNo',
  'duration',
  'hasCover',
  'addedAt',
  'glyph',
  'favorite',
  'replayGain',
  'artists',
]);

const STATE_KEYS = new Set([
  'tracks',
  'queue',
  'queueIndex',
  'playlists',
  'playHistory',
  'favoriteIds',
  'smartPlaylists',
  'settings',
  'profile',
]);

function pickKnown(obj, allowed) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const key of Object.keys(obj)) {
    if (allowed.has(key)) out[key] = obj[key];
  }
  return out;
}

function validateTrack(track, libraryRoot, index) {
  if (!track || typeof track !== 'object' || Array.isArray(track)) {
    return { ok: false, reason: `tracks[${index}] is not an object` };
  }
  const cleaned = pickKnown(track, TRACK_KEYS);
  if (!cleaned.id || typeof cleaned.id !== 'string') {
    return { ok: false, reason: `tracks[${index}] missing id` };
  }
  if (!cleaned.path || typeof cleaned.path !== 'string') {
    return { ok: false, reason: `tracks[${index}] missing path` };
  }
  const resolved = path.resolve(cleaned.path);
  if (!isUnderDir(resolved, libraryRoot)) {
    return {
      ok: false,
      reason: `tracks[${index}] path escapes library root: ${cleaned.path}`,
    };
  }
  cleaned.path = resolved;
  if (cleaned.sourcePath != null && typeof cleaned.sourcePath !== 'string') {
    delete cleaned.sourcePath;
  }
  if (typeof cleaned.title !== 'string') cleaned.title = '';
  if (typeof cleaned.artist !== 'string') cleaned.artist = 'Unknown Artist';
  if (typeof cleaned.album !== 'string') cleaned.album = 'Unknown Album';
  return { ok: true, track: cleaned };
}

/**
 * Validate and sanitize renderer save-state payload.
 * @returns {{ ok: true, state: object } | { ok: false, reason: string }}
 */
function validateSaveState(raw, libraryRoot) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'state must be an object' };
  }
  if (!libraryRoot || typeof libraryRoot !== 'string') {
    return { ok: false, reason: 'libraryRoot is required' };
  }

  const state = pickKnown(raw, STATE_KEYS);

  if (!Array.isArray(raw.tracks)) {
    return { ok: false, reason: 'tracks must be an array' };
  }

  const tracks = [];
  for (let i = 0; i < raw.tracks.length; i += 1) {
    const result = validateTrack(raw.tracks[i], libraryRoot, i);
    if (!result.ok) return result;
    tracks.push(result.track);
  }
  state.tracks = tracks;

  if (raw.queue !== undefined) {
    if (!Array.isArray(raw.queue) || raw.queue.some((id) => typeof id !== 'string')) {
      return { ok: false, reason: 'queue must be an array of track ids' };
    }
    state.queue = raw.queue;
  } else {
    state.queue = [];
  }

  if (raw.queueIndex !== undefined) {
    if (typeof raw.queueIndex !== 'number' || !Number.isFinite(raw.queueIndex)) {
      return { ok: false, reason: 'queueIndex must be a number' };
    }
    state.queueIndex = Math.max(0, Math.floor(raw.queueIndex));
  } else {
    state.queueIndex = 0;
  }

  if (raw.playlists !== undefined) {
    if (!Array.isArray(raw.playlists)) {
      return { ok: false, reason: 'playlists must be an array' };
    }
    state.playlists = raw.playlists;
  } else {
    state.playlists = [];
  }

  if (raw.playHistory !== undefined) {
    if (!Array.isArray(raw.playHistory)) {
      return { ok: false, reason: 'playHistory must be an array' };
    }
    state.playHistory = raw.playHistory;
  } else {
    state.playHistory = [];
  }

  if (raw.favoriteIds !== undefined) {
    if (!Array.isArray(raw.favoriteIds)) {
      return { ok: false, reason: 'favoriteIds must be an array' };
    }
    state.favoriteIds = raw.favoriteIds.filter((id) => typeof id === 'string');
  }

  if (raw.smartPlaylists !== undefined) {
    if (!Array.isArray(raw.smartPlaylists)) {
      return { ok: false, reason: 'smartPlaylists must be an array' };
    }
    state.smartPlaylists = raw.smartPlaylists;
  }

  if (raw.settings !== undefined) {
    if (!raw.settings || typeof raw.settings !== 'object' || Array.isArray(raw.settings)) {
      return { ok: false, reason: 'settings must be an object' };
    }
    state.settings = raw.settings;
  }

  if (raw.profile !== undefined) {
    if (!raw.profile || typeof raw.profile !== 'object' || Array.isArray(raw.profile)) {
      return { ok: false, reason: 'profile must be an object' };
    }
    state.profile = raw.profile;
  }

  return { ok: true, state };
}

module.exports = {
  validateSaveState,
  validateTrack,
  isUnderDir,
};

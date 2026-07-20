import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';
import path from 'path';

const require = createRequire(import.meta.url);
const { validateSaveState } = require('../electron/state-validator.cjs');

describe('state-validator', () => {
  const libraryRoot = path.resolve('/tmp/senza-library');
  const goodTrack = {
    id: 't1',
    path: path.join(libraryRoot, 'music', 'A', 'song.mp3'),
    title: 'Song',
    artist: 'A',
    album: 'Al',
    evilField: 'strip-me',
  };

  it('accepts valid state and strips unknown top-level and track fields', () => {
    const result = validateSaveState(
      {
        tracks: [goodTrack],
        queue: ['t1'],
        queueIndex: 0,
        playlists: [],
        playHistory: [],
        settings: { theme: 'dark' },
        hacker: true,
      },
      libraryRoot,
    );
    expect(result.ok).toBe(true);
    expect(result.state.hacker).toBeUndefined();
    expect(result.state.tracks[0].evilField).toBeUndefined();
    expect(result.state.tracks[0].id).toBe('t1');
    expect(result.state.settings.theme).toBe('dark');
  });

  it('rejects track paths outside the library root', () => {
    const result = validateSaveState(
      {
        tracks: [
          {
            id: 'bad',
            path: path.resolve('/tmp/elsewhere/evil.mp3'),
            title: 'x',
          },
        ],
      },
      libraryRoot,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/library root/i);
  });

  it('rejects non-object state', () => {
    expect(validateSaveState(null, libraryRoot).ok).toBe(false);
    expect(validateSaveState([], libraryRoot).ok).toBe(false);
  });

  it('rejects missing track id or path', () => {
    expect(
      validateSaveState({ tracks: [{ path: goodTrack.path }] }, libraryRoot).ok,
    ).toBe(false);
    expect(validateSaveState({ tracks: [{ id: 'x' }] }, libraryRoot).ok).toBe(false);
  });

  it('rejects traversal paths that escape the library', () => {
    const result = validateSaveState(
      {
        tracks: [
          {
            id: 't2',
            path: path.join(libraryRoot, 'music', '..', '..', 'escape.mp3'),
          },
        ],
      },
      libraryRoot,
    );
    expect(result.ok).toBe(false);
  });
});

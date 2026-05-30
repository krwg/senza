import { describe, it, expect } from 'vitest';
import { evaluateSmartPlaylist } from '../src/js/smart-playlists.js';

describe('smart-playlists', () => {
  const tracks = [
    { id: '1', title: 'Pop Song', genre: 'Pop', year: 2020, addedAt: new Date().toISOString() },
    { id: '2', title: 'Old Rock', genre: 'Rock', year: 1999, addedAt: '2020-01-01T00:00:00.000Z' },
  ];

  it('filters by genre rule', () => {
    const pl = { rules: [{ type: 'genre', value: 'pop' }] };
    const out = evaluateSmartPlaylist(tracks, pl, { playHistory: [], favorites: new Set() });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('1');
  });

  it('filters favorites', () => {
    const pl = { rules: [{ type: 'favorite', value: true }] };
    const out = evaluateSmartPlaylist(tracks, pl, { playHistory: [], favorites: new Set(['2']) });
    expect(out.map((t) => t.id)).toEqual(['2']);
  });
});

import { describe, it, expect } from 'vitest';
import { fuzzyFilterTracks, fuzzyScore, normalize } from '../src/js/search.js';

describe('search', () => {
  const tracks = [
    { id: '1', title: 'Strobe', artist: 'deadmau5', album: 'For Lack of a Better Name', genre: 'Electronic' },
    { id: '2', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', genre: 'Rock' },
  ];

  it('normalize strips diacritics', () => {
    expect(normalize('Café')).toBe('cafe');
  });

  it('fuzzyScore finds partial match', () => {
    expect(fuzzyScore('deadmau5 strobe', 'deadmau')).toBeGreaterThan(0.5);
  });

  it('fuzzyFilterTracks matches typo', () => {
    const out = fuzzyFilterTracks(tracks, 'deadmau5', { splitArtists: (a) => [a] });
    expect(out.map((t) => t.id)).toContain('1');
  });
});

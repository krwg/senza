import { describe, it, expect } from 'vitest';
import { buildFlowWave, FLOW_MODES } from '../src/js/flow.js';

describe('flow', () => {
  const tracks = [
    { id: 'a', title: 'A', artist: 'X', album: 'Al', path: '/music/X/Al/a.mp3' },
    { id: 'b', title: 'B', artist: 'Y', album: 'Bl', path: '/music/Y/Bl/b.mp3' },
    { id: 'c', title: 'C', artist: 'Z', album: 'Cl', path: '/music/Z/Cl/c.mp3' },
  ];

  it('builds wave without repeats in session', () => {
    const session = new Set();
    const { tracks: wave } = buildFlowWave(tracks, [], { sessionPlayed: session, size: 2 });
    expect(wave.length).toBe(2);
    expect(new Set(wave.map((t) => t.id)).size).toBe(2);
  });

  it('favorites mode boosts favorite tracks', () => {
    const fav = new Set(['a']);
    const { tracks: wave } = buildFlowWave(tracks, [], {
      mode: 'favorites',
      favoriteIds: fav,
      size: 3,
    });
    expect(wave.some((t) => t.id === 'a')).toBe(true);
  });

  it('exports flow modes', () => {
    expect(FLOW_MODES).toContain('discover');
  });
});

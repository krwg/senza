import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';
import path from 'path';
import { sanitizeGlyphFields, isVariousArtists } from '../glyph-mi/js/core/sanitize.js';

const require = createRequire(import.meta.url);
const { sanitizeSegment, isUnderDir } = require('../electron/import.cjs');

describe('import sanitizeSegment', () => {
  it('replaces forbidden path characters', () => {
    expect(sanitizeSegment('A<B>C:D')).toBe('A_B_C_D');
    expect(sanitizeSegment('x/y\\z')).toMatch(/^x_y_z$/);
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeSegment('  Hello   World  ')).toBe('Hello World');
  });

  it('falls back to Unknown for empty input', () => {
    expect(sanitizeSegment('')).toBe('Unknown');
    expect(sanitizeSegment(null)).toBe('Unknown');
  });

  it('truncates long names to 120 chars', () => {
    const long = 'x'.repeat(200);
    expect(sanitizeSegment(long).length).toBe(120);
  });
});

describe('import isUnderDir', () => {
  const root = path.resolve('/tmp/senza-lib');

  it('returns true for nested library paths', () => {
    expect(isUnderDir(path.join(root, 'music', 'a.mp3'), root)).toBe(true);
  });

  it('returns false for siblings outside root', () => {
    expect(isUnderDir(path.resolve('/tmp/other', 'a.mp3'), root)).toBe(false);
  });
});

describe('glyph sanitizeGlyphFields', () => {
  it('detects various-artists labels', () => {
    expect(isVariousArtists('Various Artists')).toBe(true);
    expect(isVariousArtists('VA')).toBe(true);
    expect(isVariousArtists('deadmau5')).toBe(false);
  });

  it('fills missing album from library folder path', () => {
    const filePath = path.join('music', 'Artist Name', 'Album Name', 'track.mp3');
    const out = sanitizeGlyphFields(filePath, {}, { title: 'Track' });
    expect(out.album).toBe('Album Name');
    expect(out.artist).toBe('Artist Name');
  });

  it('parses artist from title when artist is unknown', () => {
    const out = sanitizeGlyphFields('loose.mp3', {}, {
      artist: 'Unknown Artist',
      title: 'Some Artist - Cool Song',
    });
    expect(out.artist).toMatch(/Some Artist/i);
    expect(out.title).toMatch(/Cool Song/i);
  });

  it('does not force VA folder artist onto compilation tracks incorrectly', () => {
    const filePath = path.join('music', 'Various Artists', 'Comp', 'song.mp3');
    const out = sanitizeGlyphFields(filePath, {}, {
      artist: 'Featured Act',
      title: 'Song',
      album: 'Comp',
    });
    expect(out.artist).toBe('Featured Act');
  });
});

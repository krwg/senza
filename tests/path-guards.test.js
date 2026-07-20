import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';
import path from 'path';

const require = createRequire(import.meta.url);
const {
  assertUnderLibraryRoot,
  resolveUnderLibraryRoot,
  isUnderDir,
} = require('../electron/lib/path-guards.cjs');

describe('path-guards', () => {
  const libraryRoot = path.resolve('/tmp/senza-library');

  it('allows paths under the library root', () => {
    const inside = path.join(libraryRoot, 'music', 'Artist', 'track.mp3');
    expect(resolveUnderLibraryRoot(libraryRoot, inside)).toBe(path.resolve(inside));
    expect(() => assertUnderLibraryRoot(libraryRoot, inside)).not.toThrow();
  });

  it('rejects paths outside the library root', () => {
    const outside = path.resolve('/tmp/other', 'secret.mp3');
    expect(() => resolveUnderLibraryRoot(libraryRoot, outside)).toThrow(/library root/i);
    expect(() => assertUnderLibraryRoot(libraryRoot, outside)).toThrow(/library root/i);
  });

  it('rejects path traversal with .. segments', () => {
    const traversal = path.join(libraryRoot, 'music', '..', '..', 'etc', 'passwd');
    expect(() => resolveUnderLibraryRoot(libraryRoot, traversal)).toThrow(/library root/i);
  });

  it('rejects empty or non-string paths', () => {
    expect(() => resolveUnderLibraryRoot(libraryRoot, '')).toThrow(/invalid path/i);
    expect(() => resolveUnderLibraryRoot(libraryRoot, null)).toThrow(/invalid path/i);
  });

  it('reuses isUnderDir semantics from import', () => {
    const inside = path.join(libraryRoot, 'covers', 'a.jpg');
    expect(isUnderDir(inside, libraryRoot)).toBe(true);
    expect(isUnderDir(path.resolve('/elsewhere/x'), libraryRoot)).toBe(false);
  });
});

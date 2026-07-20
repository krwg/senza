const path = require('path');
const { isUnderDir } = require('../import.cjs');

function resolveUnderLibraryRoot(libraryRoot, filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid path');
  }
  const root = path.resolve(libraryRoot);
  const resolved = path.resolve(filePath);
  if (!isUnderDir(resolved, root)) {
    throw new Error('Path escapes library root');
  }
  return resolved;
}

function assertUnderLibraryRoot(libraryRoot, filePath) {
  resolveUnderLibraryRoot(libraryRoot, filePath);
}

module.exports = {
  assertUnderLibraryRoot,
  resolveUnderLibraryRoot,
  isUnderDir,
};

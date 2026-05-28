const path = require('path');
const fs = require('fs/promises');

async function scanDir(dir, depth = 0, maxDepth = 4) {
  if (depth > maxDepth) return { name: path.basename(dir), type: 'folder', children: [] };
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { name: path.basename(dir), type: 'folder', children: [] };
  }
  const children = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      children.push(await scanDir(full, depth + 1, maxDepth));
    } else {
      children.push({ name: entry.name, type: 'file' });
    }
  }
  return { name: path.basename(dir), type: 'folder', children };
}

async function getLibraryTree(libraryRoot) {
  const musicRoot = path.join(libraryRoot, 'music');
  try {
    await fs.access(musicRoot);
  } catch {
    return { name: 'music', type: 'folder', children: [] };
  }
  return scanDir(musicRoot);
}

module.exports = { getLibraryTree };

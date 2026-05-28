const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const { parseMetadataFile } = require('./metadata.cjs');

function getCoversDir(libraryRoot) {
  return path.join(libraryRoot, 'covers');
}

function getCoverPath(libraryRoot, trackId) {
  return path.join(getCoversDir(libraryRoot), `${trackId}.jpg`);
}

async function saveCoverFile(libraryRoot, trackId, buffer) {
  const dir = getCoversDir(libraryRoot);
  await fs.mkdir(dir, { recursive: true });
  const dest = getCoverPath(libraryRoot, trackId);
  await fs.writeFile(dest, buffer);
  return dest;
}

async function coverExists(libraryRoot, trackId) {
  return existsSync(getCoverPath(libraryRoot, trackId));
}

async function extractEmbeddedCover(filePath) {
  try {
    const parsed = await parseMetadataFile(filePath, { skipCovers: false });
    const pic = parsed.common.picture?.[0];
    if (!pic?.data?.length) return null;
    return { buffer: Buffer.from(pic.data), mime: pic.format || 'image/jpeg' };
  } catch {
    return null;
  }
}

async function extractAndStoreCover(libraryRoot, track) {
  const embedded = await extractEmbeddedCover(track.path);
  if (!embedded) return false;
  await saveCoverFile(libraryRoot, track.id, embedded.buffer);
  return true;
}

module.exports = {
  getCoverPath,
  saveCoverFile,
  coverExists,
  extractEmbeddedCover,
  extractAndStoreCover,
};

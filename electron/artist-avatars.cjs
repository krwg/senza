const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const { pathToFileURL } = require('url');

function getArtistDir(libraryRoot, slug) {
  return path.join(libraryRoot, 'artists', slug);
}

function getArtistAvatarPath(libraryRoot, slug) {
  return path.join(getArtistDir(libraryRoot, slug), 'avatar.jpg');
}

async function saveArtistAvatar(libraryRoot, slug, buffer) {
  const dir = getArtistDir(libraryRoot, slug);
  await fs.mkdir(dir, { recursive: true });
  const dest = getArtistAvatarPath(libraryRoot, slug);
  await fs.writeFile(dest, buffer);
  return dest;
}

function artistAvatarUrl(libraryRoot, slug) {
  const p = getArtistAvatarPath(libraryRoot, slug);
  if (!existsSync(p)) return '';
  return pathToFileURL(p).href;
}

module.exports = {
  getArtistAvatarPath,
  saveArtistAvatar,
  artistAvatarUrl,
};

const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'playlist';
}

async function listPlaylists(libraryRoot) {
  const root = path.join(libraryRoot, 'playlists');
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });
  const playlists = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(root, entry.name);
    const metaPath = path.join(folder, 'playlist.json');
    try {
      const raw = await fs.readFile(metaPath, 'utf8');
      playlists.push(JSON.parse(raw));
    } catch {
      playlists.push({
        id: entry.name,
        name: entry.name,
        slug: entry.name,
        trackIds: [],
        createdAt: new Date().toISOString(),
      });
    }
  }
  return playlists;
}

async function createPlaylist(libraryRoot, name) {
  const slug = slugify(name);
  const id = crypto.randomUUID();
  const folder = path.join(libraryRoot, 'playlists', slug);
  await fs.mkdir(folder, { recursive: true });
  const playlist = {
    id,
    name: name.trim(),
    slug,
    trackIds: [],
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(folder, 'playlist.json'), JSON.stringify(playlist, null, 2), 'utf8');
  return playlist;
}

async function savePlaylist(libraryRoot, playlist) {
  const folder = path.join(libraryRoot, 'playlists', playlist.slug);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'playlist.json'), JSON.stringify(playlist, null, 2), 'utf8');
  return playlist;
}

async function deletePlaylist(libraryRoot, slug) {
  const folder = path.join(libraryRoot, 'playlists', slug);
  await fs.rm(folder, { recursive: true, force: true });
}

module.exports = { listPlaylists, createPlaylist, savePlaylist, deletePlaylist };

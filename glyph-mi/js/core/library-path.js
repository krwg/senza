/** Parse Senza library layout: music/Artist/Album/track.ext */

function decodeSeg(s) {
  try {
    return decodeURIComponent(String(s || '').replace(/\+/g, ' '));
  } catch {
    return String(s || '');
  }
}

export function parseLibraryPath(filePath) {
  const parts = String(filePath || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
  const musicIdx = parts.findIndex((p) => p.toLowerCase() === 'music');
  if (musicIdx < 0 || parts.length < musicIdx + 3) return null;

  let artist = decodeSeg(parts[musicIdx + 1]);
  let album = decodeSeg(parts[musicIdx + 2]);
  const reasons = ['library folder structure'];

  if (artist.toLowerCase() === 'various artists' || artist.toLowerCase() === 'разные исполнители') {
    reasons.push('compilation folder');
  }

  const yearAlbum = album.match(/^(\d{4})\s*[-–—.:]\s*(.+)$/);
  let year = '';
  if (yearAlbum) {
    year = yearAlbum[1];
    album = yearAlbum[2].trim();
    reasons.push('year in album folder');
  }

  const discFolder = parts.length > musicIdx + 4 ? parts[musicIdx + 3] : '';
  const discMatch = discFolder.match(/^(?:disc|cd|disk)\s*(\d+)/i);
  if (discMatch) {
    reasons.push(`disc folder ${discMatch[1]}`);
  }

  return {
    artist,
    album,
    year,
    artists: artist ? [artist] : [],
    reasons,
  };
}

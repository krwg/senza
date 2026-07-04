const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');

const AUDIO_EXT = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac']);

function sanitizeSegment(name) {
  return (
    String(name || 'Unknown')
      .replace(/[<>:"/\\?*\x0-\xf]/g, '_')
      .replace(/\s/g, ' ')
      .trim()
      .slice(0, 120) || 'Unknown'
  );
}

function isUnderDir(filePath, dir) {
  const rel = path.relative(path.resolve(dir), path.resolve(filePath));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function uniqueDestPath(dir, fileName) {
  let dest = path.join(dir, fileName);
  if (!existsSync(dest)) return dest;
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  for (let n = 2; n < 1000; n += 1) {
    dest = path.join(dir, `${base} (${n})${ext}`);
    if (!existsSync(dest)) return dest;
  }
  return path.join(dir, `${base}-${Date.now()}${ext}`);
}

async function resolveLibraryAudioPath(libraryRoot, sourcePath, meta) {
  const musicRoot = path.join(libraryRoot, 'music');
  const normalizedSource = path.normalize(sourcePath);

  if (isUnderDir(normalizedSource, musicRoot)) {
    return normalizedSource;
  }

  const ext = path.extname(normalizedSource).toLowerCase();
  if (!AUDIO_EXT.has(ext)) {
    throw new Error(`Unsupported audio format: ${ext || '(none)'}`);
  }

  const artist = sanitizeSegment(meta.artist || 'Unknown Artist');
  const album = sanitizeSegment(meta.album || 'Unknown Album');
  const title = sanitizeSegment(meta.title || path.basename(normalizedSource, ext));
  const destDir = path.join(musicRoot, artist, album);
  await fs.mkdir(destDir, { recursive: true });

  const fileName = `${title}${ext}`;
  const destPath = await uniqueDestPath(destDir, fileName);
  await fs.copyFile(normalizedSource, destPath);
  return destPath;
}

module.exports = { resolveLibraryAudioPath, sanitizeSegment };

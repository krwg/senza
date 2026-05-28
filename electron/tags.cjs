const path = require('path');
const fs = require('fs/promises');
const NodeID3 = require('node-id3');
const { parseMetadataFile } = require('./metadata.cjs');

async function readTags(filePath) {
  const parsed = await parseMetadataFile(filePath);
  const pic = parsed.common.picture?.[0];
  return {
    title: parsed.common.title || '',
    artist: parsed.common.artist || parsed.common.artists?.join('; ') || '',
    album: parsed.common.album || '',
    genre: (parsed.common.genre || [])[0] || '',
    year: parsed.common.year || '',
    trackNo: parsed.common.track?.no || '',
    duration: parsed.format.duration || 0,
    hasCover: Boolean(pic),
  };
}

async function writeTags(filePath, tags) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.mp3') {
    throw new Error('Tag writing is supported for MP3 only in this version. FLAC/others coming soon.');
  }

  const tagPayload = {
    title: tags.title || '',
    artist: tags.artist || '',
    album: tags.album || '',
    genre: tags.genre || '',
    year: tags.year ? String(tags.year) : '',
    trackNumber: tags.trackNo ? String(tags.trackNo) : '',
  };

  if (tags.coverBuffer) {
    tagPayload.image = {
      imageBuffer: Buffer.from(tags.coverBuffer),
      mime: tags.coverMime || 'image/jpeg',
      type: { id: 3, name: 'front cover' },
    };
  } else if (tags.coverPath) {
    const imageBuffer = await fs.readFile(tags.coverPath);
    tagPayload.image = {
      imageBuffer,
      mime: tags.coverMime || 'image/jpeg',
      type: { id: 3, name: 'front cover' },
    };
  }

  const ok = NodeID3.write(tagPayload, filePath);
  if (!ok) throw new Error('Failed to write ID3 tags');
  return readTags(filePath);
}

module.exports = { readTags, writeTags };

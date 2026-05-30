const path = require('path');
const fs = require('fs/promises');
const NodeID3 = require('node-id3');
const { File } = require('node-taglib-sharp');
const { parseMetadataFile } = require('./metadata.cjs');

const WRITE_EXT = new Set(['.mp3', '.flac', '.ogg', '.oga', '.m4a', '.aac', '.wav']);

function replayGainFromParsed(parsed) {
  const rg = parsed.common?.replayGain;
  if (!rg) return null;
  const trackGain = rg.track?.gain ?? rg.trackGain;
  const albumGain = rg.album?.gain ?? rg.albumGain;
  if (trackGain == null && albumGain == null) return null;
  return {
    trackGainDb: trackGain != null ? Number(trackGain) : null,
    albumGainDb: albumGain != null ? Number(albumGain) : null,
  };
}

async function readTags(filePath) {
  const parsed = await parseMetadataFile(filePath);
  const pic = parsed.common.picture?.[0];
  const replayGain = replayGainFromParsed(parsed);
  return {
    title: parsed.common.title || '',
    artist: parsed.common.artist || parsed.common.artists?.join('; ') || '',
    album: parsed.common.album || '',
    genre: (parsed.common.genre || [])[0] || '',
    year: parsed.common.year || '',
    trackNo: parsed.common.track?.no || '',
    duration: parsed.format.duration || 0,
    hasCover: Boolean(pic),
    bpm: parsed.common.bpm || null,
    replayGain,
  };
}

function canWriteTags(filePath) {
  return WRITE_EXT.has(path.extname(filePath).toLowerCase());
}

function applyTaglibFields(tag, tags) {
  if (tags.title !== undefined) tag.title = tags.title || '';
  if (tags.artist !== undefined) tag.artist = tags.artist || '';
  if (tags.album !== undefined) tag.album = tags.album || '';
  if (tags.genre !== undefined) tag.genre = tags.genre || '';
  if (tags.year !== undefined && tags.year !== '') tag.year = Number(tags.year) || 0;
  if (tags.trackNo !== undefined && tags.trackNo !== '') tag.track = Number(tags.trackNo) || 0;
}

async function writeTagsWithTaglib(filePath, tags) {
  const file = File.createFromPath(filePath);
  try {
    applyTaglibFields(file.tag, tags);
    if (tags.coverBuffer?.length || tags.coverPath) {
      const imageBuffer = tags.coverBuffer
        ? Buffer.from(tags.coverBuffer)
        : await fs.readFile(tags.coverPath);
      const mime = tags.coverMime || 'image/jpeg';
      file.tag.pictures = [
        {
          mimeType: mime,
          type: 3,
          description: 'Cover',
          filename: 'cover.jpg',
          data: imageBuffer,
        },
      ];
    }
    file.save();
  } finally {
    file.dispose?.();
  }
}

async function writeTagsMp3Id3(filePath, tags) {
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
}

async function writeTags(filePath, tags) {
  const ext = path.extname(filePath).toLowerCase();
  if (!WRITE_EXT.has(ext)) {
    throw new Error(`Tag writing is not supported for ${ext || 'this format'}.`);
  }

  try {
    await writeTagsWithTaglib(filePath, tags);
  } catch (err) {
    if (ext === '.mp3') {
      await writeTagsMp3Id3(filePath, tags);
    } else {
      throw err;
    }
  }
  return readTags(filePath);
}

module.exports = { readTags, writeTags, canWriteTags, replayGainFromParsed };

let parseFileFn = null;

async function getParseFile() {
  if (!parseFileFn) {
    const { loadMusicMetadata } = require('music-metadata');
    const mm = await loadMusicMetadata();
    parseFileFn = mm.parseFile;
  }
  return parseFileFn;
}

async function parseMetadataFile(filePath, options) {
  const parseFile = await getParseFile();
  return parseFile(filePath, options);
}

module.exports = { parseMetadataFile };

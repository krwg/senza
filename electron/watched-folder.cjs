const path = require('path');

const AUDIO_EXT = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac']);

let watcher = null;
let onNewFiles = null;
let debounceTimer = null;
const pending = new Set();

function isAudioFile(filePath) {
  return AUDIO_EXT.has(path.extname(filePath).toLowerCase());
}

function flushPending() {
  if (!pending.size || !onNewFiles) return;
  const paths = [...pending];
  pending.clear();
  onNewFiles(paths).catch(() => {});
}

function scheduleFlush() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushPending, 800);
}

async function startWatch(folderPath, importCallback) {
  stopWatch();
  if (!folderPath) return { ok: false, reason: 'no path' };
  onNewFiles = importCallback;

  const chokidarMod = await import('chokidar');
  const chokidar = chokidarMod.default || chokidarMod;

  watcher = chokidar.watch(folderPath, {
    ignoreInitial: true,
    depth: 99,
    awaitWriteFinish: { stabilityThreshold: 1200, pollInterval: 200 },
  });
  watcher.on('add', (filePath) => {
    if (!isAudioFile(filePath)) return;
    pending.add(filePath);
    scheduleFlush();
  });
  return { ok: true, path: folderPath };
}

function stopWatch() {
  clearTimeout(debounceTimer);
  pending.clear();
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  onNewFiles = null;
}

module.exports = { startWatch, stopWatch };

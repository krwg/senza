const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');

function parseLrc(text) {
  const lines = [];
  const re = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/g;
  for (const rawLine of text.split(/\r?\n/)) {
    let match;
    const content = rawLine.trim();
    if (!content) continue;
    re.lastIndex = 0;
    while ((match = re.exec(content)) !== null) {
      const min = Number(match[1]);
      const sec = Number(match[2]);
      const ms = match[3] ? Number(match[3].padEnd(3, '0')) : 0;
      const time = min * 60 + sec + ms / 1000;
      const lyric = (match[4] || '').trim();
      if (lyric) lines.push({ time, text: lyric });
    }
  }
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

async function findLyricsForTrack(filePath) {
  if (!filePath || !existsSync(filePath)) return { lines: [], path: null };
  const base = path.join(path.dirname(filePath), path.basename(filePath, path.extname(filePath)));
  const candidates = [`${base}.lrc`, `${base}.LRC`];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const text = await fs.readFile(p, 'utf8');
      return { lines: parseLrc(text), path: p };
    } catch {
      
    }
  }
  return { lines: [], path: null };
}

function lyricAtTime(lines, currentSec) {
  if (!lines?.length) return '';
  let best = '';
  for (const line of lines) {
    if (line.time <= currentSec + 0.05) best = line.text;
    else break;
  }
  return best;
}

module.exports = { findLyricsForTrack, parseLrc, lyricAtTime };

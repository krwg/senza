const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const http = require('http');

const execFileAsync = promisify(execFile);

const MB_BASE = 'https://musicbrainz.org/ws/2';
const ACOUSTID_BASE = 'https://api.acoustid.org/v2/lookup';
const USER_AGENT = 'Senza/1.1.0 (krwg; Glyph metadata)';

let mbQueue = Promise.resolve();
let lastMbAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(25000, () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

function cacheDir(libraryRoot) {
  return path.join(libraryRoot, 'glyph', 'cache');
}

function cacheKey(parts) {
  return crypto.createHash('sha1').update(parts.join('\0)).digest('hex');
}

async function readCache(libraryRoot, ns, key) {
  const file = path.join(cacheDir(libraryRoot), ns, `${key}.json`);
  if (!fsSync.existsSync(file)) return null;
  try {
    const raw = await fs.readFile(file, 'utf8');
    const data = JSON.parse(raw);
    if (data.expiresAt && Date.now() > data.expiresAt) return null;
    return data.payload;
  } catch {
    return null;
  }
}

async function writeCache(libraryRoot, ns, key, payload, ttlDays = 30) {
  const dir = path.join(cacheDir(libraryRoot), ns);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${key}.json`);
  await fs.writeFile(
    file,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      expiresAt: Date.now() + ttlDays * 86400000,
      payload,
    }),
    'utf8'
  );
}

function escLucene(s) {
  return String(s || '')
    .replace(/\\g, '\\\\')
    .replace(/"/g, '\\"')
    .trim();
}

function artistFromCredit(credits) {
  if (!credits?.length) return '';
  return credits
    .map((c) => c.name || c.artist?.name || '')
    .filter(Boolean)
    .join(', ');
}

function mapRecording(rec) {
  if (!rec) return null;
  const releases = rec.releases || [];
  const rel = releases[0];
  const date = rel?.date || '';
  const year = (date.match(/\b19|20)\d2}\b) || [])[0] || '';
  return {
    title: rec.title || '',
    artist: artistFromCredit(rec['artist-credit']),
    album: rel?.title || '',
    year,
    genre: '',
    trackNo: '',
    mbRecordingId: rec.id || '',
  };
}

function scoreRecording(rec, query) {
  let score = 0;
  const gotTitle = String(rec.title || '').toLowerCase();
  const wantTitle = String(query.title || '').toLowerCase();
  const gotArtist = artistFromCredit(rec['artist-credit']).toLowerCase();
  const wantArtist = String(query.artist || '').toLowerCase();

  if (wantTitle && gotTitle === wantTitle) score += 40;
  else if (wantTitle && gotTitle.includes(wantTitle)) score += 22;
  if (wantArtist && gotArtist.includes(wantArtist.split(',')[0].trim())) score += 35;

  const durMs = Math.round((Number(query.duration) || 0) * 1000);
  if (rec.length && durMs && Math.abs(rec.length - durMs) < 3000) score += 20;
  return score;
}

function pickBest(recordings, query) {
  let best = null;
  let bestScore = 0;
  for (const rec of recordings || []) {
    const s = scoreRecording(rec, query);
    if (s > bestScore) {
      bestScore = s;
      best = rec;
    }
  }
  return bestScore >= 45 ? mapRecording(best) : null;
}

async function mbThrottle() {
  const wait = Math.max(0, 1100 - (Date.now() - lastMbAt));
  if (wait) await sleep(wait);
  lastMbAt = Date.now();
}

function enqueueMb(fn) {
  const run = mbQueue.then(fn);
  mbQueue = run.catch(() => {});
  return run;
}

async function musicBrainzLookup(libraryRoot, query = {}) {
  const title = String(query.title || '').trim();
  const artist = String(query.artist || '').trim();
  if (!title && !artist) {
    return { ok: false, error: 'need title or artist' };
  }

  const key = cacheKey(['mb', artist, title, String(query.duration || '')]);
  const cached = await readCache(libraryRoot, 'musicbrainz', key);
  if (cached) return { ok: true, fields: cached, provider: 'musicbrainz', cached: true };

  const q = title
    ? artist
      ? `recording:"${escLucene(title)}" AND artist:"${escLucene(artist)}"`
      : `recording:"${escLucene(title)}"`
    : `artist:"${escLucene(artist)}"`;

  const url = `${MB_BASE}/recording?query=${encodeURIComponent(q)}&fmt=json&limit=8`;

  try {
    const data = await enqueueMb(async () => {
      await mbThrottle();
      return fetchJson(url);
    });
    const fields = pickBest(data.recordings, { title, artist, duration: query.duration });
    if (fields) await writeCache(libraryRoot, 'musicbrainz', key, fields);
    return { ok: Boolean(fields), fields, provider: 'musicbrainz', cached: false };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function fpcalcPath() {
  const root = path.resolve(__dirname, '../tools/chromaprint');
  const win = path.join(root, 'fpcalc.exe');
  const unix = path.join(root, 'fpcalc');
  if (fsSync.existsSync(win)) return win;
  if (fsSync.existsSync(unix)) return unix;
  return null;
}

async function runFpcalc(filePath) {
  const bin = fpcalcPath();
  if (!bin) return { ok: false, error: 'fpcalc not installed — run npm run glyph:download-tools' };

  const { stdout } = await execFileAsync(bin, ['-json', '-length', '120', filePath], {
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const line = String(stdout || '')
    .trim()
    .split('\n)
    .pop();
  const data = JSON.parse(line);
  return {
    ok: true,
    duration: Math.round(Number(data.duration) || 0),
    fingerprint: String(data.fingerprint || ''),
  };
}

async function acoustidLookup(libraryRoot, { filePath, duration, apiKey }) {
  const key = String(apiKey || process.env.ACOUSTID_API_KEY || '').trim();
  if (!key) return { ok: false, error: 'AcoustID API key missing' };
  if (!filePath || !fsSync.existsSync(filePath)) return { ok: false, error: 'file not found' };

  const cacheId = cacheKey(['ac', filePath, String(fsSync.statSync(filePath).mtimeMs)]);
  const cached = await readCache(libraryRoot, 'acoustid', cacheId);
  if (cached) return { ok: true, fields: cached, provider: 'acoustid', cached: true };

  const fp = await runFpcalc(filePath);
  if (!fp.ok) return fp;

  const dur = duration || fp.duration;
  const params = new URLSearchParams({
    client: key,
    meta: 'recordings releasegroups compress',
    duration: String(dur),
    fingerprint: fp.fingerprint,
  });

  try {
    const data = await fetchJson(`${ACOUSTID_BASE}?${params}`);
    const result = data?.results?.[0];
    const rec = result?.recordings?.[0];
    if (!rec) return { ok: false, error: 'no acoustid match' };

    const fields = {
      title: rec.title || '',
      artist: (rec.artists || []).map((a) => a.name).filter(Boolean).join(', '),
      album: '',
      year: '',
      genre: '',
      trackNo: '',
      mbRecordingId: rec.id || '',
    };
    await writeCache(libraryRoot, 'acoustid', cacheId, fields);
    return { ok: true, fields, provider: 'acoustid', score: result.score, cached: false };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function chromaprintDownloadUrl() {
  const v = '1.6.0';
  const plat = process.platform;
  const arch = process.arch;
  if (plat === 'win32') {
    return {
      url: `https://github.com/acoustid/chromaprint/releases/download/v${v}/chromaprint-fpcalc-${v}-windows-x86_64.zip`,
      zip: true,
    };
  }
  if (plat === 'darwin') {
    const name = arch === 'arm64' ? 'macos-arm64' : 'macos-universal';
    return {
      url: `https://github.com/acoustid/chromaprint/releases/download/v${v}/chromaprint-fpcalc-${v}-${name}.tar.gz`,
      zip: false,
    };
  }
  return {
    url: `https://github.com/acoustid/chromaprint/releases/download/v${v}/chromaprint-fpcalc-${v}-linux-x86_64.tar.gz`,
    zip: false,
  };
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      const lib = u.startsWith('https') ? https : http;
      lib.get(u, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', async () => {
          try {
            await fs.writeFile(dest, Buffer.concat(chunks));
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    };
    follow(url);
  });
}

async function downloadChromaprintTools() {
  const { url, zip } = chromaprintDownloadUrl();
  const toolsDir = path.resolve(__dirname, '../tools/chromaprint');
  await fs.mkdir(toolsDir, { recursive: true });
  const archive = path.join(toolsDir, zip ? 'fpcalc.zip' : 'fpcalc.tar.gz');
  await downloadFile(url, archive);

  if (zip) {
    const extractDir = path.join(toolsDir, '_extract');
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(extractDir, { recursive: true });
    await promisify(execFileAsync)('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`,
    ]);
    const walk = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          const hit = await walk(p);
          if (hit) return hit;
        } else if (e.name === 'fpcalc.exe' || e.name === 'fpcalc') return p;
      }
      return null;
    };
    const found = await walk(extractDir);
    if (found) {
      const dest = path.join(toolsDir, path.basename(found));
      await fs.copyFile(found, dest);
    }
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
  } else {
    await promisify(execFileAsync)('tar', ['-xzf', archive, '-C', toolsDir]);
  }

  const bin = fpcalcPath();
  return { ok: Boolean(bin), path: bin, url };
}

function getOnlineStatus() {
  return {
    musicBrainz: true,
    fpcalc: Boolean(fpcalcPath()),
    fpcalcPath: fpcalcPath() || '',
  };
}

async function fingerprintFile(libraryRoot, { filePath }) {
  if (!filePath || !fsSync.existsSync(filePath)) {
    return { ok: false, error: 'file not found' };
  }
  const mtime = fsSync.statSync(filePath).mtimeMs;
  const cacheId = cacheKey(['fp', filePath, String(mtime)]);
  const cached = await readCache(libraryRoot, 'fingerprint', cacheId);
  if (cached?.fingerprint) {
    return { ok: true, duration: cached.duration, fingerprint: cached.fingerprint, cached: true };
  }
  const fp = await runFpcalc(filePath);
  if (!fp.ok) return fp;
  const payload = { duration: fp.duration, fingerprint: fp.fingerprint };
  await writeCache(libraryRoot, 'fingerprint', cacheId, payload, 90);
  return { ok: true, ...payload, cached: false };
}

module.exports = {
  musicBrainzLookup,
  acoustidLookup,
  fingerprintFile,
  downloadChromaprintTools,
  getOnlineStatus,
  fpcalcPath,
  runFpcalc,
};

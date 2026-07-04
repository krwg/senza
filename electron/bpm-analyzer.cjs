const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON_SCRIPT = path.join(__dirname, 'scripts', 'bpm_librosa.py');
const MAX_ANALYZE_SEC = 45;

let decodeAudio = null;
let MusicTempo = null;
let jsDepsPromise = null;

async function loadJsDeps() {
  if (jsDepsPromise) return jsDepsPromise;
  jsDepsPromise = (async () => {
    try {
      const decodeMod = await import('audio-decode');
      decodeAudio = decodeMod.default || decodeMod;
      const tempoMod = await import('music-tempo');
      MusicTempo = tempoMod.default || tempoMod;
    } catch {
      decodeAudio = null;
      MusicTempo = null;
    }
  })();
  return jsDepsPromise;
}

function findPython() {
  const candidates = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];
  return candidates[0];
}

function runLibrosaBpm(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(PYTHON_SCRIPT)) {
      resolve(null);
      return;
    }
    const py = findPython();
    const proc = spawn(py, [PYTHON_SCRIPT, filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => {
      out += d.toString();
    });
    proc.stderr.on('data', (d) => {
      err += d.toString();
    });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const line = out.trim().split('\n).pop();
      const bpm = Number(line);
      if (Number.isFinite(bpm) && bpm >= 40 && bpm <= 240) {
        resolve({ bpm: Math.round(bpm), source: 'librosa' });
      } else {
        resolve(null);
      }
    });
    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 60000);
  });
}

async function runJsBpm(filePath) {
  await loadJsDeps();
  if (!decodeAudio || !MusicTempo) return null;
  try {
    const buf = await fs.promises.readFile(filePath);
    const audioBuffer = await decodeAudio(buf);
    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const maxSamples = Math.min(channel.length, sampleRate * MAX_ANALYZE_SEC);
    const slice = channel.subarray(0, maxSamples);
    const mt = new MusicTempo(slice, sampleRate);
    const bpm = mt.tempo;
    if (Number.isFinite(bpm) && bpm >= 40 && bpm <= 240) {
      return { bpm: Math.round(bpm), source: 'music-tempo' };
    }
  } catch {
    void 0;
  }
  return null;
}

async function detectBpm(filePath, opts = {}) {
  if (opts.existingBpm && opts.existingBpm >= 40 && opts.existingBpm <= 240) {
    return { bpm: Math.round(opts.existingBpm), source: 'tags' };
  }
  const librosa = await runLibrosaBpm(filePath);
  if (librosa) return librosa;
  const js = await runJsBpm(filePath);
  if (js) return js;
  return null;
}

module.exports = { detectBpm };

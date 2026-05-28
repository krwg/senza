/** Flow ambient — palette from cover, smooth pulse 0–10 synced to playback time + BPM. */

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function colorsFromTrack(track) {
  if (!track) return { h1: 38, h2: 210, h3: 280, s: 42, l: 30 };
  const h = hashStr(`${track.artist || ''}|${track.album || ''}|${track.title || ''}`);
  return {
    h1: h % 360,
    h2: (h * 5 + 72) % 360,
    h3: (h * 11 + 180) % 360,
    s: 42 + (h % 14),
    l: 28 + (h % 10),
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export async function paletteFromCover(track, api) {
  if (!track?.id || !api?.coverUrl) return colorsFromTrack(track);
  try {
    const url = await api.coverUrl(track.id);
    if (!url) return colorsFromTrack(track);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const samples = [];
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 128) continue;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 25 || lum > 240) continue;
      samples.push(rgbToHsl(r, g, b));
    }
    if (samples.length < 4) return colorsFromTrack(track);
    samples.sort((a, b) => a.h - b.h);
    const pick = (idx) => samples[Math.min(idx, samples.length - 1)];
    const a = pick(Math.floor(samples.length * 0.2));
    const b = pick(Math.floor(samples.length * 0.55));
    const c = pick(Math.floor(samples.length * 0.85));
    return {
      h1: a.h,
      h2: b.h,
      h3: c.h,
      s: Math.min(58, Math.max(32, (a.s + b.s + c.s) / 3)),
      l: Math.min(42, Math.max(24, (a.l + b.l + c.l) / 3)),
    };
  } catch {
    return colorsFromTrack(track);
  }
}

export function applyFlowPalette(root, palette) {
  if (!root || !palette) return;
  const layer = root.querySelector('.flow-ambient');
  if (!layer) return;
  layer.style.setProperty('--flow-h1', String(palette.h1));
  layer.style.setProperty('--flow-h2', String(palette.h2));
  layer.style.setProperty('--flow-h3', String(palette.h3));
  layer.style.setProperty('--flow-s', `${palette.s}%`);
  layer.style.setProperty('--flow-l', `${palette.l}%`);
}

function resetBeatState(root) {
  root.style.setProperty('--flow-beat', '0');
  root.style.setProperty('--flow-pulse', '0');
  root.removeAttribute('data-beat-step');
  root.classList.remove('flow-beat-hit');
}

export function applyFlowAmbient(root, track, playing) {
  if (!root) return;
  root.classList.toggle('flow-view--playing', Boolean(playing && track));
  root.classList.toggle('flow-view--paused', Boolean(track && !playing));
  root.classList.toggle('flow-view--idle', !track);
  if (!playing || !track) resetBeatState(root);
}

/** Prefer stored BPM; avoid generic 118 default when possible. */
function resolveBpm(track) {
  const raw = Number(track?.glyph?.bpm);
  if (raw >= 72 && raw <= 196 && raw !== 118) return raw;
  if (raw >= 72 && raw <= 196) return raw;
  const genre = String(track?.genre || '').toLowerCase();
  if (/ambient|classical|lofi|chill/.test(genre)) return 88;
  if (/techno|house|edm|drum|dnb/.test(genre)) return 128;
  if (/hip-hop|rap|trap/.test(genre)) return 92;
  if (/metal|punk|rock/.test(genre)) return 132;
  return 110;
}

let beatRaf = null;
const beatState = {
  root: null,
  smoothBeat: 0,
  smoothPulse: 0,
  bpm: 110,
  beatOffset: 0,
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Continuous pulse 0–10 from audio.currentTime (phase within beat), smoothed each frame.
 * No discrete step "jumps" — CSS reads --flow-beat (0–1) and --flow-pulse (0–10).
 */
export function startFlowBeatSync(root, audioEl, track) {
  stopFlowBeatSync();
  if (!root || !audioEl) return;

  beatState.root = root;
  beatState.smoothBeat = 0;
  beatState.smoothPulse = 0;
  beatState.bpm = resolveBpm(track);
  beatState.beatOffset = Number(track?.glyph?.beatOffset) || 0;

  const tick = () => {
    if (!beatState.root || beatState.root !== root) return;

    if (audioEl.paused || audioEl.ended) {
      beatState.smoothBeat = lerp(beatState.smoothBeat, 0, 0.12);
      beatState.smoothPulse = lerp(beatState.smoothPulse, 0, 0.1);
      root.style.setProperty('--flow-beat', beatState.smoothBeat.toFixed(3));
      root.style.setProperty('--flow-pulse', beatState.smoothPulse.toFixed(2));
      beatRaf = requestAnimationFrame(tick);
      return;
    }

    const beatSec = 60 / beatState.bpm;
    const t = Math.max(0, audioEl.currentTime - beatState.beatOffset);
    const phase = (t % beatSec) / beatSec;
    const attack = Math.pow(1 - phase, 2.4);
    const wave = 0.35 + 0.65 * Math.sin(phase * Math.PI);
    const targetBeat = Math.min(1, attack * wave);
    const targetPulse = targetBeat * 10;

    beatState.smoothBeat = lerp(beatState.smoothBeat, targetBeat, 0.22);
    beatState.smoothPulse = lerp(beatState.smoothPulse, targetPulse, 0.18);

    root.style.setProperty('--flow-beat', beatState.smoothBeat.toFixed(3));
    root.style.setProperty('--flow-pulse', beatState.smoothPulse.toFixed(2));

    beatRaf = requestAnimationFrame(tick);
  };

  beatRaf = requestAnimationFrame(tick);
}

export function stopFlowBeatSync() {
  if (beatRaf) cancelAnimationFrame(beatRaf);
  beatRaf = null;
  if (beatState.root) resetBeatState(beatState.root);
  beatState.root = null;
  beatState.smoothBeat = 0;
  beatState.smoothPulse = 0;
}

export async function refreshFlowVisuals(root, track, playing, api) {
  if (!root) return;
  const palette = track ? await paletteFromCover(track, api) : colorsFromTrack(null);
  applyFlowPalette(root, palette);
  applyFlowAmbient(root, track, playing);
  if (playing && track) {
    beatState.bpm = resolveBpm(track);
    beatState.beatOffset = Number(track?.glyph?.beatOffset) || 0;
  }
}

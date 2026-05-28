const ADJECTIVES = [
  'amber', 'quiet', 'velvet', 'lunar', 'copper', 'misty', 'sonic', 'golden',
  'crimson', 'silver', 'neon', 'shadow', 'crystal', 'ember', 'frost', 'vivid',
];
const NOUNS = [
  'listener', 'archivist', 'curator', 'wanderer', 'collector', 'composer',
  'signal', 'groove', 'echo', 'vinyl', 'atlas', 'cipher', 'oracle', 'drifter',
];

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function randomProfileSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function randomDisplayName(seed = randomProfileSeed()) {
  const h = hashSeed(seed);
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[(h >> 4) % NOUNS.length];
  const num = (h % 900) + 100;
  return `${adj}-${noun}-${num}`;
}

/** GitHub-style identicon, 32×32 cells rendered to canvas size. */
export function drawIdenticon(canvas, seed, size = 128) {
  const ctx = canvas.getContext('2d');
  const cells = 32;
  const cell = size / cells;
  const h = hashSeed(seed || 'senza');
  const palette = [
    `hsl(${h % 360}, 45%, 38%)`,
    `hsl(${(h * 3) % 360}, 40%, 22%)`,
    `hsl(${(h * 7) % 360}, 50%, 52%)`,
  ];
  ctx.fillStyle = palette[1];
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < Math.ceil(cells / 2); x += 1) {
      const bit = (h >> ((x * 5 + y * 3) % 28)) & 1;
      if (!bit) continue;
      ctx.fillStyle = palette[0];
      ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
      ctx.fillRect((cells - 1 - x) * cell, y * cell, cell + 0.5, cell + 0.5);
    }
  }
}

export function identiconToDataUrl(seed, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  drawIdenticon(canvas, seed, size);
  return canvas.toDataURL('image/png');
}

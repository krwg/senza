/**
 * Optional ONNX inference (genre/mood). Graceful fallback when model missing.
 * Auto-activates when enough labeled rows exist in glyph-log SQLite.
 */
const path = require('path');
const fs = require('fs');

const MIN_TRAINING_ROWS = 500;

let ort = null;
try {
  ort = require('onnxruntime-node');
} catch {
  ort = null;
}

const MODEL_NAMES = ['glyph-genre-mood-v1.onnx'];

function modelsDir() {
  return path.join(__dirname, '..', 'glyph-mi', 'models');
}

function findModel() {
  const dir = modelsDir();
  for (const name of MODEL_NAMES) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let sessionPromise = null;

async function getSession() {
  if (!ort) return null;
  const modelPath = findModel();
  if (!modelPath) return null;
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(modelPath).catch(() => null);
  }
  return sessionPromise;
}

/**
 * @param {{ bpm, energy, brightness }} features
 */
async function predictGenreMood(features) {
  const session = await getSession();
  if (!session) return null;

  const bpm = Number(features.bpm) || 100;
  const energy = Number(features.energy) || 0.12;
  const brightness = Number(features.brightness) || 1400;
  const input = new ort.Tensor('float32', new Float32Array([bpm / 200, energy, brightness / 5000]), [1, 3]);

  try {
    const out = await session.run({ input });
    const logits = out.genre?.data || out.output?.data;
    if (!logits?.length) return null;
    const genres = [
      'Pop',
      'Hip-Hop',
      'Rock',
      'Electronic',
      'R&B',
      'Jazz',
      'Classical',
      'Metal',
      'Ambient',
      'Other',
    ];
    let best = 0;
    let bestI = genres.length - 1;
    for (let i = 0; i < Math.min(logits.length, genres.length); i += 1) {
      if (logits[i] > best) {
        best = logits[i];
        bestI = i;
      }
    }
    return { genre: genres[bestI], confidence: Math.min(0.92, 0.5 + best * 0.1), provider: 'glyph-onnx' };
  } catch {
    return null;
  }
}

/**
 * @param {import('better-sqlite3').Database|null} db
 */
function checkOnnxTrainingReady(db) {
  if (!db) {
    return { ready: false, labeledRows: 0, threshold: MIN_TRAINING_ROWS, modelPresent: Boolean(findModel()) };
  }
  try {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM glyph_diff WHERE field = 'genre' AND after_val IS NOT NULL AND after_val != ''`
      )
      .get();
    const labeledRows = row?.n ?? 0;
    return {
      ready: labeledRows >= MIN_TRAINING_ROWS,
      labeledRows,
      threshold: MIN_TRAINING_ROWS,
      modelPresent: Boolean(findModel()),
      runtime: Boolean(ort),
    };
  } catch {
    return { ready: false, labeledRows: 0, threshold: MIN_TRAINING_ROWS, modelPresent: Boolean(findModel()) };
  }
}

function onnxStatus() {
  return {
    runtime: Boolean(ort),
    model: findModel() || null,
    ready: Boolean(ort && findModel()),
    minTrainingRows: MIN_TRAINING_ROWS,
  };
}

module.exports = { predictGenreMood, onnxStatus, checkOnnxTrainingReady, MIN_TRAINING_ROWS };

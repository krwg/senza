const { parseMetadataFile } = require('./metadata.cjs');
const { predictGenreMood, checkOnnxTrainingReady } = require('./glyph-onnx.cjs');
const { detectBpm } = require('./bpm-analyzer.cjs');
const { replayGainFromParsed } = require('./tags.cjs');

function determineMood(bpm, energy) {
  const b = Number(bpm) || 100;
  const e = Number(energy) || 0.1;
  if (e > 0.15 && b >= 115) return 'drive';
  if (e > 0.15 && b < 115) return 'upbeat';
  if (e <= 0.15 && b >= 95) return 'focus';
  return 'chill';
}

function estimateEnergyFromGenre(genre) {
  const g = String(genre || '').toLowerCase();
  if (/metal|rock|edm|dance|hip-hop|rap|drum/i.test(g)) return 0.22;
  if (/pop|funk|disco/i.test(g)) return 0.18;
  if (/classical|ambient|jazz|lofi|chill/i.test(g)) return 0.08;
  return 0.12;
}

async function extractGlyphFeatures(filePath, meta = {}) {
  let bpm = null;
  let energy = estimateEnergyFromGenre(meta.genre);
  let brightness = 1400;
  let replayGain = null;
  let bpmSource = null;

  try {
    const parsed = await parseMetadataFile(filePath);
    const common = parsed.common || {};
    replayGain = replayGainFromParsed(parsed);
    bpm =
      common.bpm ||
      (parsed.native?.TBPM && Number(parsed.native.TBPM)) ||
      null;

    if (parsed.format?.duration && parsed.format.bitrate) {
      energy = Math.min(0.35, 0.06 + parsed.format.bitrate / 320000);
    }
  } catch {
    
  }

  const detected = await detectBpm(filePath, { existingBpm: bpm });
  if (detected?.bpm) {
    bpm = detected.bpm;
    bpmSource = detected.source;
  }

  if (!bpm) bpm = energy > 0.16 ? 120 : 90;

  let mood = determineMood(bpm, energy);
  let genreHint = meta.genre || '';

  try {
    const onnx = await predictGenreMood({ bpm, energy, brightness });
    if (onnx?.genre && !genreHint) genreHint = onnx.genre;
  } catch {
    
  }

  return {
    bpm: Math.round(bpm),
    bpmSource: bpmSource || (meta.bpm ? 'tags' : 'heuristic'),
    energy: Math.round(energy * 1000) / 1000,
    brightness: Math.round(brightness),
    mood,
    genreHint: genreHint || undefined,
    replayGain: replayGain || undefined,
    analyzedAt: new Date().toISOString(),
  };
}

module.exports = { extractGlyphFeatures, determineMood, checkOnnxTrainingReady };

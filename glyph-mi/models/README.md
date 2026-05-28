# Glyph ONNX models (optional)

Place trained models here for Electron inference (`glyph-onnx.cjs`):

- `glyph-genre-mood-v1.onnx` — input `[bpm/200, energy, brightness/5000]`, genre logits

Without a model, Glyph 2.0 uses the built-in `ml-heuristic.js` layer (no extra install).

Training (dev): export from Python/sklearn with 10 genre classes matching `glyph-onnx.cjs`.

Install optional runtime: `npm install onnxruntime-node` (native; run `npm run postinstall` after).

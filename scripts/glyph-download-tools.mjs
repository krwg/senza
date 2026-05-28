#!/usr/bin/env node
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { downloadChromaprintTools } = require(path.join(__dirname, '../electron/glyph-online.cjs'));

const result = await downloadChromaprintTools();
if (result.ok) {
  console.log('fpcalc installed:', result.path);
} else {
  console.error('Install failed');
  process.exit(1);
}

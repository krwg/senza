import { cp, mkdir, access } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = path.join(root, 'scripts', 'glyph-lab-template');
const target = path.join(root, 'glyph-lab');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(template))) {
  console.error('glyph-lab template missing:', template);
  process.exit(1);
}

async function ensureDataDirs(base) {
  for (const sub of ['data/imports', 'data/private', 'data/packs']) {
    await mkdir(path.join(base, sub), { recursive: true });
  }
}

if (!(await exists(target))) {
  await mkdir(target, { recursive: true });
  await cp(template, target, { recursive: true });
  await ensureDataDirs(target);
  console.log('Created glyph-lab/ (gitignored) with data/imports, data/private, data/packs');
  console.log('Personal playbook: glyph-lab/PLAYBOOK.ru.md');
} else {
  await ensureDataDirs(target);
  for (const item of ['server.cjs', 'index.html', 'package.json', 'vite.config.js', 'README.md']) {
    await cp(path.join(template, item), path.join(target, item), { force: true });
  }
  await cp(path.join(template, 'src'), path.join(target, 'src'), { recursive: true, force: true });
  await cp(path.join(template, 'styles'), path.join(target, 'styles'), { recursive: true, force: true });
  const playbookSrc = path.join(template, 'PLAYBOOK.ru.md');
  const playbookDst = path.join(target, 'PLAYBOOK.ru.md');
  if ((await exists(playbookSrc)) && !(await exists(playbookDst))) {
    const { copyFile } = await import('fs/promises');
    await copyFile(playbookSrc, playbookDst);
    console.log('Added PLAYBOOK.ru.md');
  }
  console.log('glyph-lab/ synced (GUI). data/ preserved. Run: npm install --prefix glyph-lab && npm run glyph-lab');
}

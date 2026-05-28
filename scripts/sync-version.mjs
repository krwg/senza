import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const releasePath = join(root, 'senza.release.json');
const pkgPath = join(root, 'package.json');

const release = JSON.parse(readFileSync(releasePath, 'utf8'));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

if (pkg.version !== release.version) {
  pkg.version = release.version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(`[sync-version] package.json → ${release.version}`);
} else {
  console.log(`[sync-version] already ${release.version}`);
}

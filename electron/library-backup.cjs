const path = require('path');
const fs = require('fs/promises');
const { existsSync, createWriteStream } = require('fs');

const ARCHIVE_NAME = 'senza-library.zip';
const MANIFEST = 'senza-backup-manifest.json';

let zipArchiveCtor = null;

async function getZipArchiveClass() {
  if (!zipArchiveCtor) {
    const mod = await import('archiver');
    zipArchiveCtor = mod.ZipArchive;
    if (!zipArchiveCtor) throw new Error('archiver: ZipArchive export missing');
  }
  return zipArchiveCtor;
}

async function exportLibrary(userDataPath, destPath) {
  const libraryRoot = path.join(userDataPath, 'library');
  const statePath = path.join(userDataPath, 'senza-state.json');
  if (!existsSync(libraryRoot)) throw new Error('Library folder not found');

  const manifest = {
    format: 'senza-library',
    version: '1.1',
    exportedAt: new Date().toISOString(),
  };

  const tmpManifest = path.join(userDataPath, MANIFEST);
  await fs.writeFile(tmpManifest, JSON.stringify(manifest, null, 2), 'utf8');

  const ZipArchive = await getZipArchiveClass();

  await new Promise((resolve, reject) => {
    const out = createWriteStream(destPath);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    out.on('close', resolve);
    out.on('error', reject);
    archive.on('error', reject);
    archive.pipe(out);
    archive.directory(libraryRoot, 'library');
    if (existsSync(statePath)) archive.file(statePath, { name: 'senza-state.json' });
    archive.file(tmpManifest, { name: MANIFEST });
    archive.finalize();
  });

  await fs.unlink(tmpManifest).catch(() => {});
  return { ok: true, path: destPath };
}

async function importLibrary(userDataPath, zipPath, { merge = false } = {}) {
  if (!existsSync(zipPath)) throw new Error('Archive not found');
  const { default: extract } = await import('extract-zip');

  const tmpDir = path.join(userDataPath, '_senza-import-tmp');
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(tmpDir, { recursive: true });

  await extract(zipPath, { dir: tmpDir });

  const librarySrc = path.join(tmpDir, 'library');
  const stateSrc = path.join(tmpDir, 'senza-state.json');
  const libraryDest = path.join(userDataPath, 'library');

  if (existsSync(librarySrc)) {
    if (!merge) {
      await fs.rm(libraryDest, { recursive: true, force: true }).catch(() => {});
    }
    await copyDir(librarySrc, libraryDest);
  }

  let importedState = null;
  if (existsSync(stateSrc)) {
    const raw = await fs.readFile(stateSrc, 'utf8');
    importedState = JSON.parse(raw);
    if (!merge) {
      await fs.writeFile(path.join(userDataPath, 'senza-state.json'), raw, 'utf8');
    }
  }

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  return { ok: true, merge, importedState };
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(from, to);
    else await fs.copyFile(from, to);
  }
}

module.exports = { exportLibrary, importLibrary, ARCHIVE_NAME };

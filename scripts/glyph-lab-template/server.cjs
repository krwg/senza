const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { URL } = require('url');
const { exec } = require('child_process');

const LAB_ROOT = __dirname;
const DATA_ROOT = path.join(LAB_ROOT, 'data');
const PORT = 5176;

function send(res, code, body, type = 'application/json') {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  res.end(data);
}

function safeDataPath(rel) {
  if (!rel || rel.includes('..')) throw new Error('Invalid path');
  const resolved = path.resolve(DATA_ROOT, rel);
  const root = path.resolve(DATA_ROOT);
  if (!resolved.startsWith(root)) throw new Error('Path outside data/');
  return resolved;
}

async function walk(dir, base = '') {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push({ type: 'dir', name: e.name, path: rel.replace(/\\/g, '/') });
      out.push(...(await walk(full, rel)));
    } else {
      const st = await fs.stat(full);
      out.push({
        type: 'file',
        name: e.name,
        path: rel.replace(/\\/g, '/'),
        size: st.size,
        mtime: st.mtime.toISOString(),
      });
    }
  }
  return out;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  return JSON.parse(raw);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const u = new URL(req.url, `http:
  const p = u.pathname;

  try {
    if (p === '/api/status') {
      const roots = ['imports', 'private', 'packs'];
      const counts = {};
      for (const r of roots) {
        const files = await walk(path.join(DATA_ROOT, r), r);
        counts[r] = {
          files: files.filter((f) => f.type === 'file').length,
          dirs: files.filter((f) => f.type === 'dir').length,
        };
      }
      let learnLines = 0;
      const imports = await walk(path.join(DATA_ROOT, 'imports'), 'imports');
      for (const f of imports) {
        if (f.type === 'file' && f.name === 'learn.jsonl') {
          const raw = await fs.readFile(safeDataPath(f.path), 'utf8');
          learnLines += raw.split('\n).filter(Boolean).length;
        }
      }
      return send(res, 200, { ok: true, dataRoot: DATA_ROOT, counts, learnLines });
    }

    if (p === '/api/tree') {
      const root = u.searchParams.get('root') || 'imports';
      if (!['imports', 'private', 'packs'].includes(root)) throw new Error('bad root');
      const tree = await walk(path.join(DATA_ROOT, root), root);
      return send(res, 200, { tree });
    }

    if (p === '/api/read') {
      const rel = u.searchParams.get('path');
      const fp = safeDataPath(rel);
      const ext = path.extname(fp).toLowerCase();
      const raw = await fs.readFile(fp, 'utf8');
      if (ext === '.jsonl') {
        const entries = raw
          .split('\n')
          .filter(Boolean)
          .map((line, i) => {
            try {
              return JSON.parse(line);
            } catch {
              return { _parseError: true, _line: i + 1, _raw: line };
            }
          });
        return send(res, 200, { kind: 'jsonl', path: rel, entries });
      }
      if (ext === '.json') {
        return send(res, 200, { kind: 'json', path: rel, data: JSON.parse(raw) });
      }
      return send(res, 200, { kind: 'text', path: rel, text: raw });
    }

    if (p === '/api/curated' && req.method === 'GET') {
      const rel = u.searchParams.get('path');
      const fp = safeDataPath(`${rel}.curated.json`);
      try {
        const data = JSON.parse(await fs.readFile(fp, 'utf8'));
        return send(res, 200, data);
      } catch {
        return send(res, 200, { curated: {} });
      }
    }

    if (p === '/api/curated' && req.method === 'POST') {
      const body = await readBody(req);
      const fp = safeDataPath(`${body.path}.curated.json`);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(
        fp,
        JSON.stringify({ curated: body.curated, updatedAt: new Date().toISOString() }, null, 2),
        'utf8'
      );
      return send(res, 200, { ok: true });
    }

    if (p === '/api/write-pack' && req.method === 'POST') {
      const body = await readBody(req);
      const zone = body.zone === 'private' ? 'private' : 'packs';
      const name = String(body.name || 'pack')
        .replace(/[^\w-]+/g, '-')
        .slice(0, 80);
      const rel = `${zone}/${name}.json`;
      const fp = safeDataPath(rel);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(fp, JSON.stringify(body.pack, null, 2), 'utf8');
      return send(res, 200, { ok: true, path: rel });
    }

    if (p === '/api/playbook') {
      const fp = path.join(LAB_ROOT, 'PLAYBOOK.ru.md');
      const text = await fs.readFile(fp, 'utf8');
      return send(res, 200, { text });
    }

    if (p === '/api/open-data') {
      const cmd =
        process.platform === 'win32'
          ? `explorer "${DATA_ROOT.replace(/\/g, '\\')}"`
          : process.platform === 'darwin'
            ? `open "${DATA_ROOT}"`
            : `xdg-open "${DATA_ROOT}"`;
      exec(cmd);
      return send(res, 200, { ok: true });
    }

    send(res, 404, { error: 'Not found' });
  } catch (err) {
    send(res, 400, { error: err.message || String(err) });
  }
});

async function boot() {
  await fs.mkdir(path.join(DATA_ROOT, 'imports'), { recursive: true });
  await fs.mkdir(path.join(DATA_ROOT, 'private'), { recursive: true });
  await fs.mkdir(path.join(DATA_ROOT, 'packs'), { recursive: true });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Glyph Lab API  http://127.0.0.1:${PORT}`);
    console.log(`Data folder     ${DATA_ROOT}`);
  });
}

boot();

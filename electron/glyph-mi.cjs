const { spawn } = require('child_process');
const path = require('path');
const { existsSync } = require('fs');

const GLYPH_MI_ROOT = path.resolve(__dirname, '../glyph-mi');
const GLYPH_MI_PY_PKG = path.join(GLYPH_MI_ROOT, 'glyph_mi');
const GLYPH_MI_VENV_PY = path.join(
  GLYPH_MI_ROOT,
  process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python'
);
const TIMEOUT_MS = 15000;

let cachedPython = null;
let cachedStatus = null;

function findPythonCandidates() {
  const list = [];
  if (process.env.GLYPH_PYTHON && existsSync(process.env.GLYPH_PYTHON)) {
    list.push(process.env.GLYPH_PYTHON);
  }
  if (existsSync(GLYPH_MI_VENV_PY)) {
    list.push(GLYPH_MI_VENV_PY);
  }
  const candidates = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
  for (const c of candidates) {
    if (!list.includes(c)) list.push(c);
  }
  return list;
}

function runProcess(exe, args, stdinJson) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: GLYPH_MI_ROOT,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Glyph MI timeout'));
    }, TIMEOUT_MS);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Glyph MI exited ${code}`));
        return;
      }
      try {
        const line = stdout.trim().split('\n').pop();
        resolve(JSON.parse(line));
      } catch (e) {
        reject(new Error(`Invalid Glyph MI response: ${stdout.slice(0, 200)}`));
      }
    });

    if (stdinJson) {
      child.stdin.write(JSON.stringify(stdinJson), 'utf8');
    }
    child.stdin.end();
  });
}

async function invokeGlyph(req) {
  const moduleArgs = ['-m', 'glyph_mi.cli'];

  if (cachedPython) {
    try {
      return await runProcess(cachedPython, moduleArgs, req);
    } catch {
      cachedPython = null;
      cachedStatus = null;
    }
  }

  for (const exe of findPythonCandidates()) {
    const args = exe === 'py' ? ['-3', ...moduleArgs] : moduleArgs;
    try {
      const out = await runProcess(exe, args, req);
      cachedPython = exe;
      return out;
    } catch {
      /* try next */
    }
  }

  throw new Error('Python or glyph-mi not found. Install: cd Glyph-MI && pip install -e .');
}

async function getGlyphMiStatus(force = false) {
  if (cachedStatus && !force) return cachedStatus;

  if (!existsSync(path.join(GLYPH_MI_ROOT, 'glyph_mi', 'cli.py'))) {
    cachedStatus = { available: false, error: 'Glyph-MI folder not found', root: GLYPH_MI_ROOT };
    return cachedStatus;
  }

  try {
    const out = await invokeGlyph({ cmd: 'ping' });
    if (!out.ok) {
      cachedStatus = { available: false, error: out.error || 'ping failed', root: GLYPH_MI_ROOT };
      return cachedStatus;
    }
    cachedStatus = {
      available: true,
      version: out.version,
      knowledgePacks: out.knowledgePacks,
      packNames: out.packNames,
      root: GLYPH_MI_ROOT,
      provider: 'glyph-mi',
    };
    return cachedStatus;
  } catch (err) {
    cachedStatus = { available: false, error: err.message, root: GLYPH_MI_ROOT };
    return cachedStatus;
  }
}

async function glyphAnalyze(input) {
  const out = await invokeGlyph({ cmd: 'analyze', input });
  if (!out.ok) throw new Error(out.error || 'analyze failed');
  return out.result;
}

async function glyphVaultScan(tracks, options = {}) {
  const out = await invokeGlyph({
    cmd: 'vault',
    tracks,
    maxFixPreview: options.maxFixPreview ?? 12,
  });
  if (!out.ok) throw new Error(out.error || 'vault scan failed');
  return out.result;
}

async function glyphReloadKnowledge() {
  const out = await invokeGlyph({ cmd: 'reload_knowledge' });
  if (!out.ok) throw new Error(out.error || 'reload failed');
  cachedStatus = null;
  return out;
}

module.exports = {
  getGlyphMiStatus,
  glyphAnalyze,
  glyphVaultScan,
  glyphReloadKnowledge,
  GLYPH_MI_ROOT,
};

const DEFAULT_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'llama3.2';

function buildPrompt(input) {
  const tags = input.tags || {};
  const path = input.filePath || '';
  return `You are Glyph, an offline music metadata assistant. Reply with ONLY valid JSON, no markdown.
Suggest ID3 tags for this audio file.

Filename: ${path}
Current tags: title="${tags.title || ''}", artist="${tags.artist || ''}", album="${tags.album || ''}", genre="${tags.genre || ''}", year="${tags.year || ''}"

JSON schema:
{"title":"","artist":"","album":"","genre":"","year":"","trackNo":"","confidence":"high|medium|low","reasons":["..."]}`;
}

function parseJsonLoose(text) {
  const raw = String(text || '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function analyzeLocal(input, options = {}) {
  const baseUrl = options.ollamaUrl || DEFAULT_URL;
  const model = options.model || DEFAULT_MODEL;
  const timeout = options.timeoutMs ?? 12000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        prompt: buildPrompt(input),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = parseJsonLoose(data.response);
    if (!parsed?.title && !parsed?.artist) return null;

    return {
      fields: {
        title: parsed.title || '',
        artist: parsed.artist || '',
        artists: String(parsed.artist || '')
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        album: parsed.album || '',
        genre: parsed.genre || '',
        year: parsed.year ? String(parsed.year) : '',
        trackNo: parsed.trackNo ? String(parsed.trackNo) : '',
      },
      confidence: {
        level: parsed.confidence || 'medium',
        score: parsed.confidence === 'high' ? 80 : parsed.confidence === 'low' ? 40 : 60,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons : ['local model'],
      },
      sources: ['glyph-local'],
      provider: 'glyph-local',
      hints: [{ field: '*', message: `model: ${model}` }],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function isLocalAgentAvailable(options = {}) {
  const baseUrl = options.ollamaUrl || DEFAULT_URL;
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

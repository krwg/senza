export const GLYPH_EVENTS = {
  SUGGEST: 'glyph.suggest',
  APPLY: 'glyph.apply',
  APPLY_EDITED: 'glyph.apply.edited',
  REJECT: 'glyph.reject',
  AUTO: 'glyph.auto',
  NOOP: 'glyph.noop',
  OLLAMA: 'glyph.ollama',
};

export const TAG_FIELDS = ['title', 'artist', 'album', 'genre', 'year', 'trackNo'];

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS glyph_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  project     TEXT NOT NULL,
  agent       TEXT NOT NULL,
  event       TEXT NOT NULL,
  input       TEXT,
  suggestion  TEXT,
  outcome     TEXT,
  confidence  REAL,
  sources     TEXT,
  accepted    INTEGER,
  edited      INTEGER,
  context     TEXT
);
CREATE INDEX IF NOT EXISTS idx_glyph_log_ts ON glyph_log(ts);
CREATE INDEX IF NOT EXISTS idx_glyph_log_event ON glyph_log(event);
CREATE TABLE IF NOT EXISTS glyph_diff (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  log_id      INTEGER NOT NULL,
  field       TEXT NOT NULL,
  val_before  TEXT,
  val_glyph   TEXT,
  val_after   TEXT,
  accepted    INTEGER,
  FOREIGN KEY (log_id) REFERENCES glyph_log(id)
);
CREATE INDEX IF NOT EXISTS idx_glyph_diff_log ON glyph_diff(log_id);
`;

export function pickTagFields(obj) {
  if (!obj) return {};
  const out = {};
  for (const f of TAG_FIELDS) {
    const v = obj[f];
    out[f] = v != null && v !== '' ? String(v).trim() : '';
  }
  return out;
}

export function fieldsEdited(suggested, outcome) {
  const s = pickTagFields(suggested);
  const o = pickTagFields(outcome);
  return TAG_FIELDS.some((f) => s[f] && o[f] && s[f] !== o[f]);
}

export function buildDiffRows(inputTags, suggestionFields, outcomeFields, accepted) {
  const before = pickTagFields(inputTags);
  const glyph = pickTagFields(suggestionFields);
  const after = pickTagFields(outcomeFields);
  const acc = accepted === true ? 1 : accepted === false ? 0 : null;
  const rows = [];

  for (const field of TAG_FIELDS) {
    const vb = before[field] || null;
    const vg = glyph[field] || null;
    const va = after[field] || null;
    if (!vb && !vg && !va) continue;
    if (vb === vg && vg === va && acc !== 0) continue;
    rows.push({
      field,
      val_before: vb,
      val_glyph: vg,
      val_after: va,
      accepted: acc,
    });
  }
  return rows;
}


export function normalizeLogPayload({
  project = 'senza',
  agent = 'music',
  event,
  track = null,
  input = null,
  suggestion = null,
  outcome = null,
  confidence = null,
  sources = [],
  accepted = null,
  edited = null,
  context = null,
}) {
  const inputTags = input?.tags ?? input ?? track ?? {};
  const suggestionFields = suggestion?.fields ?? suggestion ?? {};
  const outcomeFields = outcome?.fields ?? outcome ?? {};

  const wasEdited =
    edited === true ||
    (edited !== false &&
      event === GLYPH_EVENTS.APPLY &&
      fieldsEdited(suggestionFields, outcomeFields));

  let resolvedEvent = event;
  if (event === GLYPH_EVENTS.APPLY && wasEdited) {
    resolvedEvent = GLYPH_EVENTS.APPLY_EDITED;
  }

  const confScore =
    typeof confidence === 'number'
      ? confidence
      : confidence?.score != null
        ? Number(confidence.score)
        : null;

  const logRow = {
    ts: Date.now(),
    project,
    agent,
    event: resolvedEvent,
    input: JSON.stringify({
      trackId: track?.id ?? input?.trackId ?? null,
      path: track?.path ?? input?.path ?? null,
      tags: pickTagFields(inputTags),
    }),
    suggestion: JSON.stringify({
      fields: pickTagFields(suggestionFields),
      provider: suggestion?.provider ?? null,
    }),
    outcome: JSON.stringify({
      fields: pickTagFields(outcomeFields),
    }),
    confidence: confScore,
    sources: JSON.stringify(Array.isArray(sources) ? sources : []),
    accepted: accepted === true ? 1 : accepted === false ? 0 : null,
    edited: wasEdited ? 1 : 0,
    context: context ? JSON.stringify(context) : null,
  };

  const diffRows = buildDiffRows(
    inputTags,
    suggestionFields,
    outcomeFields,
    accepted === true ? true : accepted === false ? false : null
  );

  return { logRow, diffRows };
}

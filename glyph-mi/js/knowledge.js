/** Apply public knowledge packs to merged tag fields. */

function norm(s) {
  return String(s ?? '').trim().toLowerCase();
}

function basename(path) {
  const p = String(path || '').replace(/\\/g, '/');
  const i = p.lastIndexOf('/');
  return (i >= 0 ? p.slice(i + 1) : p).toLowerCase();
}

export function applyKnowledge(filePath, tags, fields, reasons, packs = []) {
  if (!packs.length) return { fields, reasons };

  const out = { ...fields };
  const rs = [...reasons];
  const base = basename(filePath);
  const rel = norm(filePath);

  for (const pack of packs) {
    for (const alias of pack.artistAliases || []) {
      const m = norm(alias.match);
      if (!m || !alias.artist) continue;
      const mode = alias.mode || 'tag';
      let hit = false;

      if (mode === 'path' || mode === 'folder') {
        hit = rel.includes(m) || rel.includes(`/${m}/`) || rel.includes(`\\${m}\\`);
      } else if (mode === 'tag') {
        hit = m === norm(tags?.artist);
      } else if (mode === 'basename') {
        hit = base === m || base.startsWith(`${m} -`) || base.startsWith(`${m}-`);
      } else {
        hit = m === norm(tags?.artist);
      }

      if (!hit) continue;
      const cur = norm(out.artist);
      if (!cur || cur === 'unknown artist' || (alias.force && mode !== 'tag')) {
        out.artist = alias.artist;
        rs.push(`knowledge: artist alias (${pack.id || 'pack'})`);
      }
    }

    for (const hint of pack.genreHints || []) {
      const pat = norm(hint.pattern);
      if (pat && (base.includes(pat) || rel.includes(pat)) && !out.genre && hint.genre) {
        out.genre = hint.genre;
        rs.push(`knowledge: genre hint (${pack.id || pack._sourceFile || 'pack'})`);
      }
    }

    for (const junk of pack.junkPatterns || []) {
      const pat = norm(junk.pattern);
      if (!pat) continue;
      if (base.includes(pat) || rel.includes(pat)) {
        rs.push(`knowledge: likely duplicate/junk filename (${pack.id || 'pack'})`);
      }
    }

    for (const rule of pack.folderRules || []) {
      const pat = norm(rule.match);
      if (pat && rel.includes(pat) && rule.genre && !out.genre) {
        out.genre = rule.genre;
        rs.push(`knowledge: folder rule (${pack.id || 'pack'})`);
      }
    }

    if (out.title) {
      for (const rule of pack.titleCleanup || []) {
        try {
          const re = new RegExp(rule.pattern, 'i');
          const next = out.title.replace(re, rule.replace ?? '');
          if (next !== out.title && next.trim()) {
            out.title = next.trim();
            rs.push('knowledge: title cleanup');
          }
        } catch {
          /* bad pattern */
        }
      }
    }

    for (const ex of pack.examples || []) {
      const refBase = norm(ex.ref?.basename);
      if (refBase && refBase === base) {
        const after = ex.after || ex.suggested || {};
        for (const key of ['title', 'artist', 'album', 'genre', 'year', 'trackNo']) {
          if (after[key] && !out[key]) out[key] = String(after[key]);
        }
        rs.push('knowledge pack match');
        break;
      }
    }
  }

  return { fields: out, reasons: rs };
}

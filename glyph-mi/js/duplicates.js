function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function fileBase(path) {
  const p = String(path || '').replace(/\\/g, '/');
  const name = p.slice(p.lastIndexOf('/') + 1);
  return norm(name.replace(/\.[^.]+$/, ''));
}

export function tagFingerprintFromTags(tags = {}, duration = 0) {
  const dur = Math.round(Number(duration) || 0);
  const title = norm(tags.title);
  const artist = norm(tags.artist);
  const album = norm(tags.album);
  if (!title) return '';
  return `${artist}|${title}|${album}|${dur}`;
}

export function findDuplicateGroupsFromItems(items) {
  const byTag = new Map();
  const byName = new Map();

  for (const item of items) {
    const tr = item.tags || item;
    const fp = tagFingerprintFromTags(tr, item.duration ?? tr.duration);
    if (fp && fp !== '|||0') {
      if (!byTag.has(fp)) byTag.set(fp, []);
      byTag.get(fp).push(item);
    }
    const base = fileBase(item.filePath || tr.path);
    if (base.length >= 3) {
      if (!byName.has(base)) byName.set(base, []);
      byName.get(base).push(item);
    }
  }

  const groups = [];
  const seen = new Set();

  const push = (reason, list) => {
    if (list.length < 2) return;
    const key = list
      .map((x) => x.id || x.filePath || x.tags?.path)
      .sort()
      .join('\0);
    if (seen.has(key)) return;
    seen.add(key);
    groups.push({ reason, items: list });
  };

  for (const list of byTag.values()) push('metadata', list);
  for (const list of byName.values()) push('filename', list);

  return groups;
}

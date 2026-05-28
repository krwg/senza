const BASE = '/api';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  status: () => req('/status'),
  tree: (root) => req(`/tree?root=${root}`),
  read: (path) => req(`/read?path=${encodeURIComponent(path)}`),
  getCurated: (path) => req(`/curated?path=${encodeURIComponent(path)}`),
  saveCurated: (path, curated) =>
    req('/curated', { method: 'POST', body: JSON.stringify({ path, curated }) }),
  writePack: (name, pack, zone = 'packs') =>
    req('/write-pack', { method: 'POST', body: JSON.stringify({ name, pack, zone }) }),
  playbook: () => req('/playbook'),
  openData: () => req('/open-data'),
};

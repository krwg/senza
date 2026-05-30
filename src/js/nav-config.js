/** Sidebar navigation catalog + user customization (visibility & order). */

export const NAV_CATALOG = [
  { id: 'flow', key: 'nav.flow', icon: 'flow', zone: 'main' },
  { id: 'recent', key: 'nav.recent', icon: 'recent', zone: 'main' },
  { id: 'favorites', key: 'nav.favorites', icon: 'favorite', zone: 'main' },
  { id: 'tracks', key: 'nav.tracks', icon: 'tracks', zone: 'main' },
  { id: 'albums', key: 'nav.albums', icon: 'albums', zone: 'main' },
  { id: 'artists', key: 'nav.artists', icon: 'artists', zone: 'main' },
  { id: 'playlists', key: 'nav.playlists', icon: 'playlists', zone: 'main' },
  { id: 'collection', key: 'nav.collection', icon: 'collection', zone: 'footer' },
  { id: 'vault', key: 'nav.vault', icon: 'vault', zone: 'footer' },
  { id: 'import', key: 'nav.import', icon: 'import', zone: 'footer' },
  { id: 'settings', key: 'nav.settings', icon: 'settings', zone: 'footer' },
];

export function defaultNavConfig() {
  return NAV_CATALOG.map((item, order) => ({
    id: item.id,
    visible: true,
    order,
  }));
}

export function normalizeNavConfig(raw) {
  const defaults = defaultNavConfig();
  const byId = new Map((raw || []).map((e) => [e.id, e]));
  return NAV_CATALOG.map((item, i) => {
    const saved = byId.get(item.id);
    return {
      id: item.id,
      visible: saved?.visible !== false,
      order: Number.isFinite(saved?.order) ? saved.order : i,
    };
  }).sort((a, b) => a.order - b.order);
}

export function navItemsForZone(config, zone) {
  const orderMap = new Map(config.map((c) => [c.id, c]));
  return NAV_CATALOG.filter((item) => item.zone === zone)
    .map((item) => {
      const cfg = orderMap.get(item.id) || { visible: true, order: 0 };
      return { ...item, visible: cfg.visible !== false, order: cfg.order ?? 0 };
    })
    .filter((item) => item.visible !== false)
    .sort((a, b) => a.order - b.order);
}

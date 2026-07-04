const S =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  flow: `<svg ${S}><path d="M4 14c2-4 5-6 8-6s6 2 8 6"/><path d="M4 10c2-3 5-5 8-5s6 2 8 5"/><path d="M4 6c2-2 5-4 8-4s6 2 8 4"/></svg>`,
  tracks: `<svg ${S}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="16" r="2.5"/></svg>`,
  albums: `<svg ${S}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5V3h10v2"/></svg>`,
  artists: `<svg ${S}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6"/></svg>`,
  playlists: `<svg ${S}><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
  collection: `<svg ${S}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`,
  vault: `<svg ${S}><path d="M4 19h16"/><path d="M7 16V8"/><path d="M12 16V5"/><path d="M17 16v-6"/></svg>`,
  import: `<svg ${S}><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`,
  settings: `<svg ${S}><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  queue: `<svg ${S}><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg>`,
  play: `<svg ${S}><path d="M9 7l10 5-10 5V7z" fill="currentColor" stroke="none"/></svg>`,
  pause: `<svg ${S}><rect x="7" y="6" width="3.5" height="12" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" stroke="none"/></svg>`,
  prev: `<svg ${S}><path d="M6 7v10"/><path d="M18 7l-8 5 8 5V7z" fill="currentColor" stroke="none"/></svg>`,
  next: `<svg ${S}><path d="M18 7v10"/><path d="M6 7l8 5-8 5V7z" fill="currentColor" stroke="none"/></svg>`,
  minimize: `<svg ${S}><path d="M5 12h14"/></svg>`,
  maximize: `<svg ${S}><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
  restore: `<svg ${S}><path d="M8 3h8v5H8V3z"/><path d="M6 8v11h11v-6H6z"/></svg>`,
  close: `<svg ${S}><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>`,
  chevronDown: `<svg ${S}><path d="M6 9l6 6 6-6"/></svg>`,
  chevronLeft: `<svg ${S}><path d="M15 6l-6 6 6 6"/></svg>`,
  plus: `<svg ${S}><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  journal: `<svg ${S}><path d="M6 4h12v16H6z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>`,
  recent: `<svg ${S}><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>`,
  favorite: `<svg ${S}><path d="M12 20l-1.5-1.4C6.5 15.2 4 12.8 4 9.5 4 7 6 5 8.5 5c1.4 0 2.7.7 3.5 1.8C12.8 5.7 14.1 5 15.5 5 18 5 20 7 20 9.5c0 3.3-2.5 5.7-6.5 9.1L12 20z"/></svg>`,
  heart: `<svg ${S}><path d="M12 20l-1.5-1.4C6.5 15.2 4 12.8 4 9.5 4 7 6 5 8.5 5c1.4 0 2.7.7 3.5 1.8C12.8 5.7 14.1 5 15.5 5 18 5 20 7 20 9.5c0 3.3-2.5 5.7-6.5 9.1L12 20z"/></svg>`,
  heartOutline: `<svg ${S}><path d="M12 20l-1.5-1.4C6.5 15.2 4 12.8 4 9.5 4 7 6 5 8.5 5c1.4 0 2.7.7 3.5 1.8C12.8 5.7 14.1 5 15.5 5 18 5 20 7 20 9.5c0 3.3-2.5 5.7-6.5 9.1L12 20z" fill="none"/></svg>`,
  shuffle: `<svg ${S}><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>`,
  repeat: `<svg ${S}><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`,
  repeatOne: `<svg ${S}><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/><text x="12" y="15" fill="currentColor" stroke="none" font-size="8" font-weight="700" text-anchor="middle">1</text></svg>`,
  lyrics: `<svg ${S}><path d="M6 6h12"/><path d="M6 10h8"/><path d="M6 14h10"/><path d="M6 18h6"/></svg>`,
  album: `<svg ${S}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg>`,
  artist: `<svg ${S}><circle cx="12" cy="10" r="3"/><path d="M6 19c0-2.8 2.7-5 6-5s6 2.2 6 5"/></svg>`,
  music: `<svg ${S}><path d="M11 6v10"/><path d="M11 6l6-1.5v8"/><circle cx="8" cy="17" r="2.5"/></svg>`,
  cultiva: `<svg ${S}><path d="M12 20V10"/><path d="M8 14c0-4 1.5-7 4-9 2.5 2 4 5 4 9"/><path d="M16 14c0-4-1.5-7-4-9"/></svg>`,
  blip: `<svg ${S}><path d="M4 12h2"/><path d="M8 12h2"/><path d="M12 12h2"/><path d="M16 12h2"/><circle cx="12" cy="12" r="2"/></svg>`,
  senza: `<svg ${S}><path d="M9 18V6l10-2v10"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/></svg>`,
};

export function icon(name, extraClass = '') {
  const cls = ['icon', 'icon-host', extraClass].filter(Boolean).join(' ');
  return `<span class="${cls}" aria-hidden="true">${ICONS[name] || ''}</span>`;
}

export function setIcon(el, name) {
  const node = typeof el === 'string' ? document.getElementById(el) : el;
  if (!node) return;
  node.classList.add('icon-host');
  node.innerHTML = ICONS[name] || '';
}

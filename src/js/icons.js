/** SF Symbols–style stroke icons (no emoji) */
const S =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  tracks: `<svg ${S}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="16" r="2.5"/></svg>`,
  albums: `<svg ${S}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5V3h10v2"/></svg>`,
  artists: `<svg ${S}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6"/></svg>`,
  playlists: `<svg ${S}><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
  collection: `<svg ${S}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`,
  vault: `<svg ${S}><path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L12 3z"/></svg>`,
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

import { t } from './i18n.js';

/** @typedef {{ id: string }} SettingsNavItem */
/** @typedef {{ id: string, labelKey: string, items: SettingsNavItem[] }} SettingsNavGroup */

/** @type {SettingsNavGroup[]} */
export const SETTINGS_NAV_GROUPS = [
  {
    id: 'app',
    labelKey: 'settings.nav_group_app',
    items: [{ id: 'appearance' }, { id: 'library' }, { id: 'playback' }],
  },
  {
    id: 'info',
    labelKey: 'settings.nav_group_info',
    items: [{ id: 'profile' }, { id: 'journal' }, { id: 'about' }],
  },
];

export function renderSettingsNavHtml(locale, activeSection) {
  return SETTINGS_NAV_GROUPS.map((group) => {
    const buttons = group.items
      .map((item) => {
        const selected = item.id === activeSection ? ' selected' : '';
        return `<button type="button" class="settings-nav-btn${selected}" data-settings-section="${item.id}" data-i18n="settings.section_${item.id}">${t(`settings.section_${item.id}`, locale)}</button>`;
      })
      .join('');
    return `
      <div class="settings-nav-group">
        <div class="settings-nav-group-label" data-i18n="${group.labelKey}">${t(group.labelKey, locale)}</div>
        ${buttons}
      </div>`;
  }).join('');
}

import manifest from '../../senza.release.json';

export const RELEASE = Object.freeze({ ...manifest });

export function formatVersionLine(locale = 'en') {
  const { version, codename } = RELEASE;
  if (locale === 'ru') {
    return `v${version} · кодовое имя «${codename}»`;
  }
  return `v${version} · codename ${codename}`;
}

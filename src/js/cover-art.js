/** Deterministic gradient when no cover file (Auto Cover Studio lite). */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function gradientForTrack(track) {
  const key = `${track?.artist || ''}|${track?.album || ''}|${track?.title || ''}`;
  const h = hashStr(key);
  const h1 = h % 360;
  const h2 = (h * 7 + 40) % 360;
  return `linear-gradient(145deg, hsl(${h1}, 42%, 32%) 0%, hsl(${h2}, 38%, 18%) 100%)`;
}

export function applyArtworkElement(el, track, imageUrl) {
  if (!el) return;
  el.classList.remove('has-cover', 'has-gradient');
  el.style.backgroundImage = '';
  if (imageUrl) {
    el.classList.add('has-cover');
    el.style.backgroundImage = `url("${imageUrl}")`;
    el.innerHTML = '';
    return;
  }
  if (track) {
    el.classList.add('has-gradient');
    el.style.backgroundImage = gradientForTrack(track);
    el.innerHTML = '';
  }
}

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

export function gradientForArtist(name) {
  return gradientForTrack({ artist: name || '', album: '', title: name || '' });
}

export function applyArtistPortrait(el, name, imageUrl) {
  if (!el) return;
  el.classList.add('artist-portrait');
  let img = el.querySelector('.artist-portrait-img');
  if (!imageUrl) {
    img?.remove();
    applyArtworkElement(el, { artist: name, album: '', title: name }, null);
    return;
  }
  el.classList.remove('has-gradient');
  el.classList.add('has-cover');
  el.style.backgroundImage = '';
  if (!img) {
    img = document.createElement('img');
    img.className = 'artist-portrait-img';
    img.alt = name ? `${name}` : '';
    img.decoding = 'async';
    el.insertBefore(img, el.firstChild);
  }
  img.src = imageUrl;
  img.removeAttribute('width');
  img.removeAttribute('height');
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

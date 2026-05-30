/** Keyboard shortcuts and media session integration. */

export function initHotkeys({ player, audio, getLocale, onToggleFavorite, getCurrentTrack }) {
  const muted = { value: false, prevVolume: 0.85 };

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  document.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        player.toggle();
        break;
      case 'ArrowRight':
        if (e.shiftKey) player.next();
        else player.seek((audio.currentTime || 0) + 10);
        break;
      case 'ArrowLeft':
        if (e.shiftKey) player.prev();
        else player.seek(Math.max(0, (audio.currentTime || 0) - 10));
        break;
      case 'KeyM':
        if (muted.value) {
          audio.volume = muted.prevVolume;
          muted.value = false;
        } else {
          muted.prevVolume = audio.volume;
          audio.volume = 0;
          muted.value = true;
        }
        break;
      case 'KeyL':
        if (onToggleFavorite && getCurrentTrack?.()) {
          e.preventDefault();
          onToggleFavorite(getCurrentTrack().id);
        }
        break;
      default:
        break;
    }
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => audio.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => player.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => player.next());
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      player.seek(Math.max(0, (audio.currentTime || 0) - 10));
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
      player.seek((audio.currentTime || 0) + 10);
    });
  }
}

export function updateMediaSession(track, playing) {
  if (!('mediaSession' in navigator) || !track) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title || 'Senza',
    artist: track.artist || '',
    album: track.album || '',
  });
  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

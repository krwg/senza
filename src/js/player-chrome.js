import { formatDuration } from './library.js';
import { setIcon } from './icons.js';
import { t } from './i18n.js';
import { applyArtworkElement } from './cover-art.js';
import { formatArtistsDisplay } from './artists.js';
import { updateMediaSession } from './hotkeys.js';

export function initPlayerChrome(player, audio, localeRef, coverApi, { onLyricsTick, lyricsEnabled } = {}) {
  const progressBars = [
    document.getElementById('progressBar'),
    document.getElementById('progressBarPanel'),
    document.getElementById('progressBarFs'),
  ].filter(Boolean);

  const timeCurrentEls = [
    document.getElementById('timeCurrent'),
    document.getElementById('timeCurrentPanel'),
    document.getElementById('timeCurrentFs'),
  ].filter(Boolean);

  const timeTotalEls = [
    document.getElementById('timeTotal'),
    document.getElementById('timeTotalPanel'),
    document.getElementById('timeTotalFs'),
  ].filter(Boolean);

  const artEls = ['npArt', 'npPanelArt', 'fsArt'].map((id) => document.getElementById(id)).filter(Boolean);

  const overlay = document.getElementById('nowPlayingOverlay');
  const fullscreen = document.getElementById('fullscreenPlayer');
  let seeking = false;
  let lastDuration = 0;

  function getLocale() {
    return typeof localeRef === 'function' ? localeRef() : localeRef;
  }

  async function refreshArtwork(track) {
    let url = '';
    if (track?.id) url = await coverApi.coverUrl(track.id);
    for (const el of artEls) {
      applyArtworkElement(el, track, url);
    }
  }

  function setTimes(current, duration) {
    const cur = formatDuration(current);
    const tot = formatDuration(duration);
    timeCurrentEls.forEach((el) => {
      el.textContent = cur;
    });
    timeTotalEls.forEach((el) => {
      el.textContent = tot;
    });
  }

  function setProgress(current, duration) {
    lastDuration = duration || lastDuration;
    const max = lastDuration > 0 ? lastDuration : 100;
    const val = lastDuration > 0 ? current : 0;
    if (seeking) return;
    progressBars.forEach((bar) => {
      bar.max = String(max);
      bar.value = String(val);
    });
    setTimes(current, lastDuration);
    if (lyricsEnabled && onLyricsTick) onLyricsTick(current);
  }

  function bindProgressBar(bar) {
    bar.addEventListener('pointerdown', () => {
      seeking = true;
    });
    bar.addEventListener('input', () => {
      seeking = true;
      const v = Number(bar.value);
      setTimes(v, lastDuration);
      progressBars.forEach((b) => {
        if (b !== bar) b.value = bar.value;
      });
    });
    bar.addEventListener('change', () => {
      player.seek(Number(bar.value));
      seeking = false;
    });
    bar.addEventListener('pointerup', () => {
      seeking = false;
    });
    bar.addEventListener('pointercancel', () => {
      seeking = false;
    });
  }

  progressBars.forEach(bindProgressBar);

  player.setOnTimeUpdate((current, duration) => {
    if (!seeking) setProgress(current, duration);
  });

  function fillTrackMeta(track) {
    const title = track?.title || '—';
    const artist = track ? formatArtistsDisplay(track.artist) || '—' : '—';
    const album = track?.album || '';

    document.getElementById('npTitle').textContent = title;
    document.getElementById('npArtist').textContent = artist;

    const panelTitle = document.getElementById('npPanelTitle');
    const panelArtist = document.getElementById('npPanelArtist');
    const panelAlbum = document.getElementById('npPanelAlbum');
    if (panelTitle) panelTitle.textContent = title;
    if (panelArtist) panelArtist.textContent = artist;
    if (panelAlbum) panelAlbum.textContent = album || '—';

    const fsTitle = document.getElementById('fsTitle');
    const fsArtist = document.getElementById('fsArtist');
    const fsAlbum = document.getElementById('fsAlbum');
    if (fsTitle) fsTitle.textContent = title;
    if (fsArtist) fsArtist.textContent = artist;
    if (fsAlbum) fsAlbum.textContent = album || '—';
  }

  function syncRepeatShuffleIcons() {
    const repeat = player.getRepeatMode?.() || 'off';
    const shuffle = player.getShuffle?.() || false;
    const repeatBtn = document.getElementById('btnRepeat');
    const shuffleBtn = document.getElementById('btnShuffle');
    if (repeatBtn) {
      repeatBtn.dataset.mode = repeat;
      repeatBtn.classList.toggle('active', repeat !== 'off');
      setIcon(repeatBtn, repeat === 'one' ? 'repeatOne' : 'repeat');
      repeatBtn.title =
        repeat === 'one'
          ? t('player.repeatOne', getLocale())
          : repeat === 'all'
            ? t('player.repeatAll', getLocale())
            : t('player.repeatOff', getLocale());
    }
    if (shuffleBtn) {
      shuffleBtn.classList.toggle('active', shuffle);
    }
  }

  function onPlaybackUpdate(track, playing) {
    fillTrackMeta(track);
    void refreshArtwork(track);
    syncPlayIcon(playing);
    syncRepeatShuffleIcons();
    updateMediaSession(track, playing);
  }

  function syncPlayIcon(playing) {
    const ids = ['btnPlay', 'btnPlayPanel', 'btnPlayFs'];
    for (const id of ids) {
      setIcon(id, playing ? 'pause' : 'play');
    }
  }

  function wireTransport(id, fn) {
    document.getElementById(id)?.addEventListener('click', fn);
  }

  wireTransport('btnPlay', () => player.toggle());
  wireTransport('btnNext', () => player.next());
  wireTransport('btnPrev', () => player.prev());
  wireTransport('btnPlayPanel', () => player.toggle());
  wireTransport('btnNextPanel', () => player.next());
  wireTransport('btnPrevPanel', () => player.prev());
  wireTransport('btnPlayFs', () => player.toggle());
  wireTransport('btnNextFs', () => player.next());
  wireTransport('btnPrevFs', () => player.prev());

  document.getElementById('btnRepeat')?.addEventListener('click', () => {
    player.cycleRepeat?.();
    syncRepeatShuffleIcons();
  });
  document.getElementById('btnShuffle')?.addEventListener('click', () => {
    player.toggleShuffle?.();
    syncRepeatShuffleIcons();
  });

  document.getElementById('nowPlayingBtn')?.addEventListener('click', () => {
    overlay?.classList.remove('hidden');
    setIcon('npCollapse', 'chevronDown');
    setIcon('npFullscreen', 'fullscreen');
  });
  document.getElementById('npCollapse')?.addEventListener('click', () => overlay?.classList.add('hidden'));
  document.getElementById('npOverlayBackdrop')?.addEventListener('click', () => overlay?.classList.add('hidden'));
  document.getElementById('npFullscreen')?.addEventListener('click', () => {
    fullscreen?.classList.remove('hidden');
    setIcon('fsClose', 'close');
  });
  document.getElementById('fsClose')?.addEventListener('click', () => fullscreen?.classList.add('hidden'));
  document.getElementById('fsBackdrop')?.addEventListener('click', () => fullscreen?.classList.add('hidden'));

  return { onPlaybackUpdate, syncPlayIcon, syncRepeatShuffleIcons };
}

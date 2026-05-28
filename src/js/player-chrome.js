import { formatDuration } from './library.js';
import { setIcon } from './icons.js';
import { t } from './i18n.js';
import { applyArtworkElement } from './cover-art.js';
import { formatArtistsDisplay } from './artists.js';

export function initPlayerChrome(player, audio, localeRef, coverApi) {
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

  function openOverlay() {
    if (!player.getQueue()[player.getIndex()]) return;
    overlay?.classList.remove('hidden');
    document.getElementById('nowPlayingPanel')?.classList.add('open');
    applyI18nPanel();
  }

  function closeOverlay() {
    overlay?.classList.add('hidden');
    document.getElementById('nowPlayingPanel')?.classList.remove('open');
    fullscreen?.classList.add('hidden');
  }

  function openFullscreen() {
    if (!player.getQueue()[player.getIndex()]) return;
    overlay?.classList.remove('hidden');
    fullscreen?.classList.remove('hidden');
    applyI18nPanel();
  }

  function applyI18nPanel() {
    const loc = getLocale();
    document.querySelectorAll('#nowPlayingOverlay [data-i18n], #fullscreenPlayer [data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key, loc);
    });
  }

  document.getElementById('nowPlayingBtn')?.addEventListener('click', openOverlay);
  document.getElementById('npOverlayBackdrop')?.addEventListener('click', closeOverlay);
  document.getElementById('npCollapse')?.addEventListener('click', closeOverlay);
  document.getElementById('npFullscreen')?.addEventListener('click', openFullscreen);
  document.getElementById('fsClose')?.addEventListener('click', () => fullscreen?.classList.add('hidden'));
  document.getElementById('fsBackdrop')?.addEventListener('click', () => fullscreen?.classList.add('hidden'));

  ['btnPlayPanel', 'btnPrevPanel', 'btnNextPanel', 'btnPlayFs', 'btnPrevFs', 'btnNextFs'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id.includes('Play')) el.addEventListener('click', () => player.toggle());
    if (id.includes('Prev')) el.addEventListener('click', () => player.prev());
    if (id.includes('Next')) el.addEventListener('click', () => player.next());
  });

  setIcon('npCollapse', 'chevronDown');
  setIcon('npFullscreen', 'maximize');
  setIcon('fsClose', 'close');
  setIcon('btnPlayPanel', 'play');
  setIcon('btnPrevPanel', 'prev');
  setIcon('btnNextPanel', 'next');
  setIcon('btnPlayFs', 'play');
  setIcon('btnPrevFs', 'prev');
  setIcon('btnNextFs', 'next');

  return {
    async onPlaybackUpdate(track, playing) {
      fillTrackMeta(track);
      await refreshArtwork(track);
      setIcon('btnPlay', playing ? 'pause' : 'play');
      setIcon('btnPlayPanel', playing ? 'pause' : 'play');
      setIcon('btnPlayFs', playing ? 'pause' : 'play');
      if (!track) {
        setProgress(0, 0);
        closeOverlay();
      } else if (!seeking) {
        setProgress(audio.currentTime, audio.duration || track.duration || 0);
      }
    },
    closeOverlay,
    refreshArtwork,
  };
}

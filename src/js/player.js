export function createPlayer(audioEl, onUpdate, fileUrlFn, opts = {}) {
  let crossfadeSec = opts.crossfadeSec ?? 0;
  let loadGen = 0;

  let queue = [];
  let index = 0;
  let onTimeUpdate = null;
  let repeatMode = 'off'; 
  let shuffleOn = false;
  let shuffleOrder = [];

  function baseVolume() {
    if (typeof opts.getVolume === 'function') return opts.getVolume();
    return opts.baseVolume ?? 0.85;
  }

  function current() {
    if (shuffleOn && shuffleOrder.length) {
      return queue[shuffleOrder[index]] || null;
    }
    return queue[index] || null;
  }

  function queueIndexForTrack(queueIdx) {
    if (!shuffleOn) return queueIdx;
    const pos = shuffleOrder.indexOf(queueIdx);
    return pos >= 0 ? pos : 0;
  }

  function realIndex() {
    if (shuffleOn && shuffleOrder.length) return shuffleOrder[index] ?? index;
    return index;
  }

  function emit(extra = {}) {
    onUpdate({
      track: current(),
      playing: !audioEl.paused,
      queue,
      index: realIndex(),
      repeatMode,
      shuffleOn,
      ...extra,
    });
  }

  function rebuildShuffle(keepQueueIdx) {
    shuffleOrder = queue.map((_, i) => i);
    for (let i = shuffleOrder.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
    }
    if (keepQueueIdx != null && keepQueueIdx >= 0) {
      const pos = shuffleOrder.indexOf(keepQueueIdx);
      if (pos > 0) {
        shuffleOrder.splice(pos, 1);
        shuffleOrder.unshift(keepQueueIdx);
      }
      index = 0;
    }
  }

  function fadeVolume(el, from, to, durationMs) {
    const ms = Math.max(80, durationMs);
    const steps = Math.max(6, Math.round(ms / 45));
    const stepMs = ms / steps;
    return new Promise((resolve) => {
      let step = 0;
      const tick = () => {
        step += 1;
        const t = step / steps;
        el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
        if (step >= steps) resolve();
        else setTimeout(tick, stepMs);
      };
      tick();
    });
  }

  function waitCanPlay(el, gen) {
    if (el.readyState >= 2) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        el.removeEventListener('canplay', done);
        el.removeEventListener('loadeddata', done);
        resolve();
      };
      el.addEventListener('canplay', done);
      el.addEventListener('loadeddata', done);
      setTimeout(done, 8000);
    }).then(() => {
      if (gen !== loadGen) return;
    });
  }

  async function loadAndPlay() {
    const gen = ++loadGen;
    const track = current();
    if (!track) {
      audioEl.pause();
      audioEl.removeAttribute('src');
      emit();
      return;
    }

    const src = fileUrlFn ? await fileUrlFn(track.path) : track.path;
    if (gen !== loadGen) return;

    const targetVol = baseVolume();
    const useCrossfade = crossfadeSec > 0 && audioEl.src && !audioEl.paused;

    try {
      if (useCrossfade) {
        const halfMs = (crossfadeSec * 1000) / 2;
        await fadeVolume(audioEl, audioEl.volume, 0, halfMs);
        if (gen !== loadGen) return;
        audioEl.src = src;
        await waitCanPlay(audioEl, gen);
        if (gen !== loadGen) return;
        audioEl.volume = 0;
        await audioEl.play().catch(() => {});
        await fadeVolume(audioEl, 0, targetVol, halfMs);
      } else {
        audioEl.src = src;
        audioEl.volume = targetVol;
        await waitCanPlay(audioEl, gen);
        if (gen !== loadGen) return;
        await audioEl.play().catch(() => {});
      }
    } catch {
      
    }

    if (gen !== loadGen) return;
    emit();
  }

  function playTrack(track, newQueue, startIndex = 0) {
    queue = newQueue || [track];
    const queueIdx = Math.max(0, Math.min(startIndex, queue.length - 1));
    if (shuffleOn) {
      rebuildShuffle(queueIdx);
    } else {
      index = queueIdx;
    }
    loadAndPlay();
  }

  audioEl.addEventListener('play', () => emit());
  audioEl.addEventListener('pause', () => emit());
  audioEl.addEventListener('ended', () => {
    if (repeatMode === 'one') {
      audioEl.currentTime = 0;
      audioEl.play().catch(() => {});
      return;
    }
    next(true);
  });
  audioEl.addEventListener('loadedmetadata', () => emit());
  audioEl.addEventListener('timeupdate', () => {
    if (onTimeUpdate) onTimeUpdate(audioEl.currentTime, audioEl.duration);
    emit();
  });

  function toggle() {
    if (audioEl.paused) audioEl.play();
    else audioEl.pause();
  }

  function next(fromEnded = false) {
    if (repeatMode === 'one' && !fromEnded) {
      audioEl.currentTime = 0;
      emit();
      return;
    }
    const maxIdx = shuffleOn ? shuffleOrder.length - 1 : queue.length - 1;
    if (index < maxIdx) {
      index += 1;
      loadAndPlay();
      return;
    }
    if (repeatMode === 'all' && queue.length) {
      index = 0;
      loadAndPlay();
      return;
    }
    if (fromEnded) {
      audioEl.pause();
      emit({ ended: true });
    }
  }

  function prev() {
    if (audioEl.currentTime > 3) {
      audioEl.currentTime = 0;
      emit();
      return;
    }
    if (index > 0) {
      index -= 1;
      loadAndPlay();
    }
  }

  function seek(seconds) {
    if (!Number.isFinite(seconds)) return;
    audioEl.currentTime = Math.max(0, Math.min(seconds, audioEl.duration || seconds));
    emit();
  }

  function setQueue(newQueue, newIndex = 0) {
    queue = newQueue;
    const qIdx = Math.max(0, Math.min(newIndex, queue.length - 1));
    if (shuffleOn) rebuildShuffle(qIdx);
    else index = qIdx;
    emit();
  }

  function reorderQueue(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const item = queue.splice(fromIdx, 1)[0];
    queue.splice(toIdx, 0, item);
    if (shuffleOn) rebuildShuffle(toIdx === index ? toIdx : realIndex());
    else if (fromIdx === index) index = toIdx;
    else if (fromIdx < index && toIdx >= index) index -= 1;
    else if (fromIdx > index && toIdx <= index) index += 1;
    emit();
  }

  function setRepeat(mode) {
    repeatMode = ['off', 'all', 'one'].includes(mode) ? mode : 'off';
    emit();
  }

  function toggleShuffle() {
    shuffleOn = !shuffleOn;
    if (shuffleOn) rebuildShuffle(realIndex());
    emit();
  }

  function setShuffle(on) {
    shuffleOn = Boolean(on);
    if (shuffleOn) rebuildShuffle(realIndex());
    emit();
  }

  function setOnTimeUpdate(fn) {
    onTimeUpdate = fn;
  }

  function cycleRepeat() {
    const order = ['off', 'all', 'one'];
    const i = order.indexOf(repeatMode);
    setRepeat(order[(i + 1) % order.length]);
    return repeatMode;
  }

  function setCrossfadeSec(sec) {
    crossfadeSec = Math.max(0, Number(sec) || 0);
  }

  function setBaseVolume(vol) {
    opts.baseVolume = vol;
    if (!audioEl.paused) audioEl.volume = vol;
  }

  return {
    playTrack,
    toggle,
    next,
    prev,
    seek,
    setQueue,
    reorderQueue,
    setOnTimeUpdate,
    setRepeat,
    toggleShuffle,
    setShuffle,
    cycleRepeat,
    setCrossfadeSec,
    setBaseVolume,
    getQueue: () => queue,
    getIndex: () => realIndex(),
    getAudio: () => audioEl,
    getRepeatMode: () => repeatMode,
    getShuffle: () => shuffleOn,
    isCrossfading: () => false,
  };
}

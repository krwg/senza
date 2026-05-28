export function createPlayer(audioEl, onUpdate, fileUrlFn) {
  let queue = [];
  let index = 0;
  let onTimeUpdate = null;

  function current() {
    return queue[index] || null;
  }

  function emit(extra = {}) {
    onUpdate({
      track: current(),
      playing: !audioEl.paused,
      queue,
      index,
      currentTime: audioEl.currentTime || 0,
      duration: Number.isFinite(audioEl.duration) ? audioEl.duration : 0,
      ...extra,
    });
  }

  function playTrack(track, newQueue, startIndex = 0) {
    queue = newQueue || [track];
    index = startIndex;
    loadAndPlay();
  }

  async function loadAndPlay() {
    const track = current();
    if (!track) {
      audioEl.pause();
      audioEl.removeAttribute('src');
      emit();
      return;
    }
    if (fileUrlFn) {
      audioEl.src = await fileUrlFn(track.path);
    } else {
      audioEl.src = track.path;
    }
    audioEl.play().catch(() => {});
    emit();
  }

  audioEl.addEventListener('play', () => emit());
  audioEl.addEventListener('pause', () => emit());
  audioEl.addEventListener('ended', () => next());
  audioEl.addEventListener('loadedmetadata', () => emit());
  audioEl.addEventListener('timeupdate', () => {
    if (onTimeUpdate) onTimeUpdate(audioEl.currentTime, audioEl.duration);
    emit();
  });

  function toggle() {
    if (audioEl.paused) audioEl.play();
    else audioEl.pause();
  }

  function next() {
    if (index < queue.length - 1) {
      index += 1;
      loadAndPlay();
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
    index = newIndex;
    emit();
  }

  function reorderQueue(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const item = queue.splice(fromIdx, 1)[0];
    queue.splice(toIdx, 0, item);
    if (fromIdx === index) index = toIdx;
    else if (fromIdx < index && toIdx >= index) index -= 1;
    else if (fromIdx > index && toIdx <= index) index += 1;
    emit();
  }

  function setOnTimeUpdate(fn) {
    onTimeUpdate = fn;
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
    getQueue: () => queue,
    getIndex: () => index,
    getAudio: () => audioEl,
  };
}

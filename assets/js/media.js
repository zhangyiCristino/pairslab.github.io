// One lifecycle for hero, research-card and direction-preview videos.
// Fetch only a visible, active video; stop playback when it leaves the screen.
(() => {
  const videos = [...document.querySelectorAll('[data-hero-video], [data-research-video], [data-research-loop], .research-choice-video')];
  if (!videos.length) return;
  const visible = new Set();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const update = () => videos.forEach(video => {
    const previewPreference = video.closest('[data-previews-paused]')?.dataset.previewsPaused;
    const paused = previewPreference === undefined
      ? reducedMotion.matches || connection?.saveData
      : previewPreference === 'true';
    if (document.hidden || paused || !visible.has(video) || video.closest('[hidden], [data-hero-slide]:not(.is-active)')) {
      video.pause();
      return;
    }
    if (video.dataset.loaded !== 'true') {
      video.querySelectorAll('source[data-src]').forEach(source => { source.src = source.dataset.src; });
      video.dataset.loaded = 'true';
      video.load();
    }
    if (video.paused) video.play().catch(() => {});
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting && entry.intersectionRatio >= .1
        ? visible.add(entry.target) : visible.delete(entry.target));
      update();
    }, { threshold: [0, .1] });
    videos.forEach(video => observer.observe(video));
  } else {
    // Older browsers keep the posters until an explicit page interaction.
    document.addEventListener('pairs:mediachange', () => {
      videos.forEach(video => {
        const rect = video.getBoundingClientRect();
        if (rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight) visible.add(video);
        else visible.delete(video);
      });
    });
  }
  document.addEventListener('pairs:mediachange', update);
  document.addEventListener('visibilitychange', update);
  reducedMotion.addEventListener('change', update);
  connection?.addEventListener('change', update);
})();

(function () {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const total = slides.length;
  let index = 0;
  let animating = false;
  const progress = document.getElementById('progress');
  const hint = document.getElementById('nav-hint');

  const MAP_SLIDES = {
    8: 'overview',
    9: 'baozhong',
    10: 'harbor',
    12: 'lingzhi',
    21: 'jiangang'
  };

  function updateProgress() {
    if (progress) progress.style.width = ((index + 1) / total * 100) + '%';
  }

  function activateMaps(n, from) {
    const mode = MAP_SLIDES[n];
    if (mode && window.DeckMaps) {
      DeckMaps.showShared(true);
      const sequential =
        (from === 8 && n === 9) || (from === 9 && n === 10) ||
        (from === 9 && n === 8) || (from === 10 && n === 9) ||
        (from === 8 && n === 10);
      DeckMaps.flyTo(mode, sequential ? 1600 : 900);
    } else if (window.DeckMaps) {
      // keep map warm but hidden when leaving sequence briefly? hide when not in map slides
      if (![8,9,10,12,21].includes(n)) DeckMaps.showShared(false);
    }
    if (n === 22 && window.DeckMaps) {
      DeckMaps.showShared(false);
      requestAnimationFrame(() => DeckMaps.initBeerMap());
    }
  }

  function go(to, opts) {
    if (to < 0 || to >= total || to === index || animating) return;
    animating = true;
    const from = index;
    const prev = slides[from];
    const next = slides[to];
    prev.classList.remove('is-active');
    prev.classList.add('is-exit');
    next.classList.add('is-active');
    index = to;
    updateProgress();
    activateMaps(to + 1, from + 1); // 1-based slide numbers in MAP_SLIDES
    // hash
    try { history.replaceState(null, '', '#' + (to + 1)); } catch (_) {}
    setTimeout(() => {
      prev.classList.remove('is-exit');
      animating = false;
    }, 560);
    if (hint) hint.classList.add('hide');
  }

  function next() { go(index + 1); }
  function prev() { go(index - 1); }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault(); next();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault(); prev();
    } else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(total - 1); }
  });

  // click zones
  const left = document.querySelector('.zone-left');
  const right = document.querySelector('.zone-right');
  if (left) left.addEventListener('click', (e) => { if (!e.target.closest('.maplibre-map, .maplibregl-ctrl, a, button, .map-host')) prev(); });
  if (right) right.addEventListener('click', (e) => { if (!e.target.closest('.maplibre-map, .maplibregl-ctrl, a, button, .map-host')) next(); });

  // wheel
  let wheelLock = 0;
  document.addEventListener('wheel', (e) => {
    const now = Date.now();
    if (now < wheelLock) return;
    if (Math.abs(e.deltaY) < 20) return;
    // don't steal when interacting with map
    if (e.target.closest && e.target.closest('.maplibre-map, .maplibregl-canvas-container')) return;
    wheelLock = now + 700;
    if (e.deltaY > 0) next(); else prev();
  }, { passive: true });

  // touch
  let tx = 0;
  document.addEventListener('touchstart', (e) => { tx = e.changedTouches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) next(); else prev();
  }, { passive: true });

  // boot
  const hash = parseInt((location.hash || '').replace('#', ''), 10);
  index = (!isNaN(hash) && hash >= 1 && hash <= total) ? hash - 1 : 0;
  slides.forEach((s, i) => s.classList.toggle('is-active', i === index));
  updateProgress();
  // warm maps after paint
  requestAnimationFrame(() => {
    if (window.DeckMaps) DeckMaps.ensureShared();
    activateMaps(index + 1, null);
  });

  window.Deck = { go, next, prev, index: () => index, total };
})();

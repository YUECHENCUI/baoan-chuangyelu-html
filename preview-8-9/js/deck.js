(function () {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const total = slides.length;
  let index = 0;
  let animating = false;
  const progress = document.getElementById('progress');
  const hint = document.getElementById('nav-hint');
  const counter = document.getElementById('preview-counter');

  // Preview only: slide 0 = overview, slide 1 = baozhong
  const MAP_MODES = ['overview', 'baozhong'];

  function updateProgress() {
    if (progress) progress.style.width = ((index + 1) / total * 100) + '%';
    if (counter) counter.textContent = (index === 0 ? '08' : '09') + ' / preview';
  }

  function activateMaps(n, from) {
    if (!window.DeckMaps) return;
    DeckMaps.showShared(true);
    const sequential = from != null && Math.abs(from - n) === 1;
    DeckMaps.flyTo(MAP_MODES[n], sequential ? 1600 : 900);
  }

  function go(to) {
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
    activateMaps(to, from);
    try { history.replaceState(null, '', '#' + (to === 0 ? '8' : '9')); } catch (_) {}
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

  const left = document.querySelector('.zone-left');
  const right = document.querySelector('.zone-right');
  if (left) left.addEventListener('click', (e) => {
    if (!e.target.closest('.maplibre-map, .maplibregl-ctrl, a, button, .map-host')) prev();
  });
  if (right) right.addEventListener('click', (e) => {
    if (!e.target.closest('.maplibre-map, .maplibregl-ctrl, a, button, .map-host')) next();
  });

  let wheelLock = 0;
  document.addEventListener('wheel', (e) => {
    const now = Date.now();
    if (now < wheelLock) return;
    if (Math.abs(e.deltaY) < 20) return;
    if (e.target.closest && e.target.closest('.maplibre-map, .maplibregl-canvas-container')) return;
    wheelLock = now + 700;
    if (e.deltaY > 0) next(); else prev();
  }, { passive: true });

  let tx = 0;
  document.addEventListener('touchstart', (e) => { tx = e.changedTouches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) next(); else prev();
  }, { passive: true });

  const hash = (location.hash || '').replace('#', '');
  index = (hash === '9') ? 1 : 0;
  slides.forEach((s, i) => s.classList.toggle('is-active', i === index));
  updateProgress();
  requestAnimationFrame(() => {
    if (window.DeckMaps) DeckMaps.ensureShared();
    activateMaps(index, null);
  });

  window.Deck = { go, next, prev, index: () => index, total };
})();

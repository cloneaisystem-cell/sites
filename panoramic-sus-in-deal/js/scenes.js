// Far-view scenes: the fixed backdrop crossfades between day / balcony / dusk / night
// as each open "view" section approaches. The railing (CSS mask) scrolls in front of it.
export function initScenes() {
  const layers = new Map([...document.querySelectorAll('[data-layer]')].map(el => [el.dataset.layer, el]));
  const markers = [...document.querySelectorAll('.hero[data-scene], .gap[data-scene]')];
  let current = 'day';
  let ticking = false;

  function set(name) {
    if (name === current || !layers.has(name)) return;
    layers.get(current)?.classList.remove('is-active');
    layers.get(name).classList.add('is-active');
    current = name;
    document.documentElement.dataset.activeScene = name;
  }
  function pick() {
    ticking = false;
    const vh = innerHeight;
    let next = markers[0]?.dataset.scene || 'day';
    for (const m of markers) {
      if (m.getBoundingClientRect().top < vh * 1.04) next = m.dataset.scene;
    }
    set(next);
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(pick);
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  document.documentElement.dataset.activeScene = 'day';
  pick();
  return { get current() { return current; }, set };
}

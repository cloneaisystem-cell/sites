// Sticky action bar. Hidden while the booking form is on screen; on desktop also while the hero
// (which already carries both actions) fills the first screen. Phones keep the bar from the start.
// Scroll-driven (not IntersectionObserver) so it also behaves under the frame-capture virtual clock.
export function initBar() {
  const bar = document.getElementById('bar');
  const form = document.getElementById('rezerva');
  const hero = document.querySelector('.hero');
  if (!bar || !form) return;
  const phone = matchMedia('(max-width: 820px)');
  let ticking = false;

  function apply() {
    ticking = false;
    const vh = innerHeight;
    const f = form.getBoundingClientRect();
    const formVisible = Math.min(f.bottom, vh) - Math.max(f.top, 0) > Math.min(f.height, vh) * 0.2;
    let heroVisible = false;
    if (hero) {
      const h = hero.getBoundingClientRect();
      heroVisible = h.bottom > vh * 0.45;
    }
    bar.classList.toggle('is-hidden', formVisible || (!phone.matches && heroVisible));
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  apply();
}

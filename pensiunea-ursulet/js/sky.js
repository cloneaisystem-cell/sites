// The hero sky turns slowly about Polaris with scroll; the mini constellation lights one star per section.
export function initSky() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sky = document.getElementById('sky');
  const hero = document.getElementById('acasa');
  const mini = document.getElementById('mini');
  const footer = document.getElementById('footer');
  const secs = [hero, ...document.querySelectorAll('[data-star]')];
  const segs = mini ? [...mini.querySelectorAll('.seg')] : [];
  const stars = mini ? [...mini.querySelectorAll('.ms')] : [];
  let ticking = false, last = -1, lastRot = 999;

  const update = () => {
    ticking = false;
    const y = window.scrollY, vh = window.innerHeight, hh = hero.offsetHeight || vh;
    if (sky && !reduce) {
      const rot = -Math.min(y / hh, 1.1) * 14;
      if (Math.abs(rot - lastRot) > 0.02) { sky.style.setProperty('--rot', rot.toFixed(2) + 'deg'); lastRot = rot; }
    }
    if (!mini) return;
    mini.classList.toggle('is-on', y > hh * 0.55);
    let cur = 0;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top <= vh * 0.45) cur = i; });
    const closed = footer.getBoundingClientRect().top < vh * 0.92;
    const key = cur + (closed ? 10 : 0);
    if (key === last) return;
    last = key;
    segs.forEach((s) => { const k = +s.dataset.k; s.classList.toggle('is-on', k <= 6 ? cur >= k : closed); });
    stars.forEach((s) => { const k = +s.dataset.k; s.classList.toggle('is-on', k <= cur); s.classList.toggle('is-cur', k === cur); });
  };
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  update();

  if (mini) mini.addEventListener('click', (e) => {
    const s = e.target.closest('.ms'); if (!s) return;
    const t = secs[+s.dataset.k];
    if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
}

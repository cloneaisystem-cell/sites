// RedCut demo: tabs (barber picker), open/closed status, click-to-load map, pen underline, ceiling parallax, ready flag.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* barber picker (WAI-ARIA tabs, vertical on desktop, horizontal chips on phones) */
(function picker() {
  const tabs = $$('.tabs [role="tab"]');
  if (!tabs.length) return;
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    if (tab.scrollIntoView && matchMedia('(max-width: 899px)').matches) tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const k = e.key;
      const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (k in map) { e.preventDefault(); select(tabs[(i + map[k] + tabs.length) % tabs.length], true); }
      else if (k === 'Home') { e.preventDefault(); select(tabs[0], true); }
      else if (k === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
    });
  });
})();

/* open / closed, in Bucharest time (hours from MERO) */
(function status() {
  const H = { 1: ['10:00', '20:00'], 2: ['10:00', '20:00'], 3: ['10:00', '20:00'], 4: ['10:00', '20:00'], 5: ['10:00', '20:00'], 6: ['09:30', '17:00'], 0: null };
  const NAMES = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
  const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fmt = (t) => t.replace(/^0/, '');
  let now;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const g = (t) => parts.find((p) => p.type === t).value;
    now = { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')), min: Number(g('hour')) % 24 * 60 + Number(g('minute')) };
  } catch (e) { const d = new Date(); now = { day: d.getDay(), min: d.getHours() * 60 + d.getMinutes() }; }
  let text, open = false;
  const today = H[now.day];
  if (today && now.min >= mins(today[0]) && now.min < mins(today[1])) { open = true; text = `Deschis acum, până la ${fmt(today[1])}`; }
  else {
    let d = now.day, add = 0;
    if (!(today && now.min < mins(today[0]))) { do { d = (d + 1) % 7; add++; } while (!H[d]); }
    const when = add === 0 ? 'azi' : add === 1 ? 'mâine' : NAMES[d];
    text = `Închis acum, deschide ${when} la ${fmt(H[d][0])}`;
  }
  const hero = $('[data-open]');
  if (hero) { hero.textContent = text; hero.hidden = false; hero.classList.toggle('is-open', open); }
  const st = $('[data-status]'); if (st) st.textContent = text + '.';
  const row = $(`.tbl tr[data-day="${now.day}"]`); if (row) row.classList.add('today');
})();

/* map loads from Google only after a click */
(function map() {
  const box = $('[data-map]'), btn = $('[data-map-load]');
  if (!box || !btn) return;
  btn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.title = 'Harta: RedCut Hair Studio, Str. Ceahlăul 3, București';
    f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://www.google.com/maps?q=44.45308,26.05170&z=17&output=embed';
    box.replaceChildren(f);
  });
})();

/* the red pen underlines 100000 when it scrolls into view */
(function pen() {
  const el = $('.pen2');
  if (!el) return;
  if (reduced || !('IntersectionObserver' in window)) { el.classList.add('on'); return; }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { el.classList.add('on'); io.disconnect(); } }, { threshold: 0.9 });
  io.observe(el.parentElement);
})();

/* ceiling follows the pointer a little (desktop, fine pointer only) */
(function parallax() {
  const hero = $('.hero'), ceil = $('.ceil');
  if (!hero || !ceil || reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const loop = () => {
    x += (tx - x) * 0.06; y += (ty - y) * 0.06;
    ceil.style.setProperty('--px', x.toFixed(3)); ceil.style.setProperty('--py', y.toFixed(3));
    raf = (Math.abs(tx - x) + Math.abs(ty - y) > 0.002) ? requestAnimationFrame(loop) : 0;
  };
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
})();

/* ready: fonts + first painted frames (intro runs on CSS time, so recorders can capture it) */
(async function ready() {
  try { await document.fonts.ready; } catch (e) {}
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
})();

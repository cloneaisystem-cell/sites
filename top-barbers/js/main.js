// Page behaviour: the hero floor (WebGL when available and motion is allowed), the sticky header and phone dock,
// price tabs, today's row and the open/closed line (Europe/Bucharest), the click-to-load map, one-time reveals.
const root = document.documentElement;
const hero = document.getElementById('top');
const header = document.getElementById('header');
const dock = document.getElementById('dock');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const recording = new URLSearchParams(location.search).has('record') || window.__recording;
// a frame-exact recording sets the scroll position itself: native smooth scrolling would fight it
if (recording) root.style.scrollBehavior = 'auto';

// ---- scroll: solid header, dock, the camera walking forward over the floor
let app = null, lastY = scrollY, heroH = hero.offsetHeight, ticking = false;
function onScroll() {
  const y = scrollY;
  header.classList.toggle('is-solid', y > 40);
  if (!reduced) root.style.setProperty('--sy', Math.round(y));
  if (dock) dock.classList.toggle('is-on', y > Math.min(heroH * 0.55, 520));
  if (app) {
    app.setScroll(y / Math.max(1, heroH));
    app.kick(Math.abs(y - lastY) * 0.0011);   // the pole turns faster while you scroll, then settles
  }
  lastY = y; ticking = false;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', () => { heroH = hero.offsetHeight; });

// ---- the floor
function staticMode() {
  root.classList.remove('gl'); root.classList.add('no-gl');
  window.__app = window.__app || { renderer: null, static: true };
  const img = hero.querySelector('.hero__static img');
  const done = () => { window.__ready = true; };
  if (img && !img.complete) { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); } else done();
}
if (root.classList.contains('gl')) {
  import('./floor.js')
    .then((m) => m.startFloor({ canvas: document.getElementById('gl'), hero }))
    .then((a) => { app = a; onScroll(); })
    .catch((err) => { console.warn('floor unavailable, using the static image', err); staticMode(); });
} else {
  staticMode();
}
onScroll();

// ---- price tabs (without JS all three lists simply stack)
document.querySelectorAll('[data-tabs]').forEach((box) => {
  const tabs = [...box.querySelectorAll('[role="tab"]')];
  const select = (t, focus) => {
    tabs.forEach((x) => {
      const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).classList.toggle('is-active', on);
    });
    if (focus) t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); select(tabs[(i + k + tabs.length) % tabs.length], true); }
      if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
      if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
    });
  });
});

// ---- today's row and the open/closed line, in Bucharest time
const HOURS = { 1: [600, 1200], 2: [600, 1200], 3: [600, 1200], 4: [600, 1200], 5: [600, 1200], 6: [540, 840], 0: null };
const DAY = { 0: 'duminică', 1: 'luni', 2: 'marți', 3: 'miercuri', 4: 'joi', 5: 'vineri', 6: 'sâmbătă' };
const hhmm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
try {
  // Capture only (?record=1 or ?freeze=1): ?clock=2026-11-03T12:30 pins the Bucharest time used below, so demo videos and
  // stills made in the evening still show the shop's weekday status. A normal visit always uses the real time.
  const q = new URLSearchParams(location.search);
  const pin = (recording || q.has('freeze')) && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(q.get('clock') || '');
  let dow, now;
  if (pin) { dow = new Date(Date.UTC(+pin[1], +pin[2] - 1, +pin[3])).getUTCDay(); now = +pin[4] * 60 + +pin[5]; }
  else {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date()).map((p) => [p.type, p.value]));
    dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
    now = (+parts.hour % 24) * 60 + +parts.minute;
  }
  const row = document.querySelector(`.hours tr[data-dow="${dow}"]`);
  if (row) { row.classList.add('is-today'); row.setAttribute('aria-current', 'date'); }
  const el = document.getElementById('openNow');
  const today = HOURS[dow];
  let line;
  if (today && now >= today[0] && now < today[1]) line = `<span class="dot" aria-hidden="true"></span><b>Deschis acum</b>, până la ${hhmm(today[1])}`;
  else {
    let next = null, add = 0;
    if (today && now < today[0]) { next = today; add = 0; }
    else for (let i = 1; i <= 7 && !next; i++) { const d = (dow + i) % 7; if (HOURS[d]) { next = HOURS[d]; add = i; } }
    const nd = (dow + add) % 7;
    line = `<span class="dot is-closed" aria-hidden="true"></span><b>Închis acum</b>, deschide ${add === 0 ? 'azi' : add === 1 ? 'mâine' : DAY[nd]} la ${hhmm(next[0])}`;
  }
  if (el) el.innerHTML = line;
} catch (e) { /* the static line reads fine without it */ }

// ---- map: nothing from OpenStreetMap loads until the visitor asks for it
const mapBtn = document.getElementById('mapLoad');
if (mapBtn) mapBtn.addEventListener('click', () => {
  const box = document.getElementById('mapBox');
  const f = document.createElement('iframe');
  f.title = 'Harta: The Top Barbers, Strada Tăietura Turcului 47, Cluj-Napoca';
  f.src = 'https://www.openstreetmap.org/export/embed.html?bbox=23.5555%2C46.7755%2C23.5665%2C46.7829&layer=mapnik&marker=46.77920%2C23.56085';
  f.loading = 'lazy'; f.referrerPolicy = 'no-referrer';
  box.replaceChildren(f);
});

// ---- reveals: held back only when below the fold, released once
if (!reduced && 'IntersectionObserver' in window) {
  const els = [...document.querySelectorAll('.rv')];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.remove('pre'); e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  for (const el of els) { if (el.getBoundingClientRect().top > innerHeight * 0.92) { el.classList.add('pre'); io.observe(el); } }
}

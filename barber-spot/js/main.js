// The Barber Spot, demo. One moment: the mirrors light up.
// No timers drive the choreography (delays live in CSS), so frame-capture's virtual clock works.
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mirrors = [...document.querySelectorAll('[data-mirror]')];
const hero = document.querySelector('[data-mirror="hero"]');

function light(m, delay = 0) {
  if (m.classList.contains('is-lit')) return;
  m.style.setProperty('--d', delay + 'ms');
  const host = m.closest('[data-mirror-host]');
  if (host) { host.style.setProperty('--d', delay + 'ms'); host.classList.add('is-lit'); }
  m.classList.add('is-lit');
}

// everything but the hero lights as it scrolls into view
const rest = mirrors.filter((m) => m !== hero);
if (reduce || !('IntersectionObserver' in window)) {
  mirrors.forEach((m) => light(m));
} else {
  const io = new IntersectionObserver((entries) => {
    let k = 0;
    entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.left - b.boundingClientRect.left).forEach((e) => {
      light(e.target, k++ * 130);
      io.unobserve(e.target);
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -6% 0px' });
  rest.forEach((m) => io.observe(m));
  // belt and braces for scripted scrolling (recorders set scrollTop directly)
  let queued = false;
  const sweep = () => {
    queued = false;
    let k = 0;
    rest.forEach((m) => {
      if (m.classList.contains('is-lit')) return;
      const r = m.getBoundingClientRect();
      if (r.top < innerHeight * 0.88 && r.bottom > 0) light(m, k++ * 130);
    });
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(sweep); } }, { passive: true });
}

// header: hairline once scrolled
const header = document.getElementById('header');
const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// in-page anchors: smooth only when motion is welcome
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const t = id.length > 1 && document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', id);
  });
});

// open now / closed now, in Bucharest time
const status = document.getElementById('status');
const HOURS = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }; // Mon..Sat: 11-16 and 17-21, Sunday closed (MERO, 03.11.2026)
const SLOTS = [[11 * 60, 16 * 60], [17 * 60, 21 * 60]];
const DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
// ?now=2026-11-03T12:30:00+02:00 pins the clock (demo recordings only)
const pinned = new URLSearchParams(location.search).get('now');
function bucharestNow() {
  const d = pinned && !isNaN(Date.parse(pinned)) ? new Date(pinned) : new Date();
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const get = (t) => p.find((x) => x.type === t).value;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { dow, min: (+get('hour') % 24) * 60 + +get('minute') };
}
const hh = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function paintStatus() {
  const { dow, min } = bucharestNow();
  document.querySelectorAll('.hours tr').forEach((tr) => tr.classList.toggle('is-today', +tr.dataset.dow === dow));
  let text, open = '0';
  if (HOURS[dow]) {
    const cur = SLOTS.find(([a, b]) => min >= a && min < b);
    const next = SLOTS.find(([a]) => min < a);
    if (cur) { text = 'Deschis acum, până la ' + hh(cur[1]); open = '1'; }
    else if (next) text = 'Închis acum, deschidem la ' + hh(next[0]);
  }
  if (!text) {
    let d = (dow + 1) % 7, n = 1;
    while (!HOURS[d]) { d = (d + 1) % 7; n++; }
    text = 'Închis acum, deschidem ' + (n === 1 ? 'mâine' : DAYS[d]) + ' la 11:00';
  }
  status.textContent = text;
  status.dataset.open = open;
}
try { paintStatus(); } catch (e) { /* keep the static line */ }

// map loads only after a click (no third-party request before consent by action)
const mapBtn = document.getElementById('mapLoad');
mapBtn?.addEventListener('click', () => {
  const f = document.createElement('iframe');
  f.title = 'Harta: The Barber Spot, Str. Valea Oltului 12, București';
  f.loading = 'lazy';
  f.referrerPolicy = 'no-referrer-when-downgrade';
  f.src = 'https://www.google.com/maps?q=44.4179927,26.0140067&z=17&output=embed';
  mapBtn.replaceWith(f);
});

// hero: wait for fonts and the photo, then switch the mirror on; then declare ready
async function start() {
  try { await document.fonts.ready; } catch (e) {}
  const img = hero.querySelector('img');
  try { if (img && !img.complete) await new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }); if (img?.decode) await img.decode(); } catch (e) {}
  if (window.__recording && !reduce) {
    // frame-capture: stay unlit through the pre-roll, ignite on the recorder's clock
    window.__recordFrame = (t) => { if (t >= 0.1) light(hero, 150); };
    requestAnimationFrame(() => { window.__ready = true; });
    return;
  }
  requestAnimationFrame(() => {
    light(hero, 250);
    requestAnimationFrame(() => { window.__ready = true; });
  });
}
window.__app = { mirrors: mirrors.length };
start();

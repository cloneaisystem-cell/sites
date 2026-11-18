// Urban Blade demo: live open/closed chip, today's hours, the pole turning with scroll, click-to-load map.
const TZ = 'Europe/Bucharest';
const HOURS = { 0: null, 1: [9, 21], 2: [9, 21], 3: [9, 21], 4: [9, 21], 5: [9, 21], 6: [9, 18] }; // MERO, 03.11.2026
const DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

function nowInBucharest() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')];
  return { day, minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10) };
}

function statusText({ day, minutes }) {
  const today = HOURS[day];
  if (today && minutes >= today[0] * 60 && minutes < today[1] * 60) return { open: true, text: `Deschis acum · până la ${today[1]}:00` };
  if (today && minutes < today[0] * 60) return { open: false, text: `Închis acum · deschidem azi la ${today[0]}:00` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (HOURS[d]) {
      const when = i === 1 ? 'mâine' : DAYS[d];
      return { open: false, text: `Închis acum · deschidem ${when} la ${HOURS[d][0]}:00` };
    }
  }
  return { open: false, text: 'Închis acum' };
}

function initStatus() {
  const now = nowInBucharest();
  const chip = document.getElementById('status');
  if (chip) { const s = statusText(now); chip.dataset.open = String(s.open); chip.textContent = s.text; }
  const row = document.querySelector(`#hours li[data-d="${now.day}"]`);
  if (row) row.setAttribute('aria-current', 'date');
}

// the pole: stripes advance with scroll (one authored motion). Only transforms change, so nothing repaints.
// Static under reduced motion.
function initPole() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = [document.getElementById('pole'), document.getElementById('tape')].filter(Boolean).map((el) => ({ el, S: 56 }));
  const measure = () => { for (const t of targets) t.S = parseFloat(getComputedStyle(t.el).getPropertyValue('--S')) || 56; };
  let y = -1, ticking = false;
  const apply = () => {
    ticking = false;
    const v = window.scrollY;
    if (v === y) return;
    y = v;
    const k = v * 0.42;
    for (const t of targets) t.el.style.setProperty('--m', `${(k % t.S).toFixed(2)}px`);
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } };
  measure();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { measure(); y = -1; apply(); }, { passive: true });
  apply();
}

function initReveal() {
  const els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  els.forEach((e) => io.observe(e));
}

function initMap() {
  const btn = document.getElementById('map-btn');
  const box = document.getElementById('map');
  if (!btn || !box) return;
  btn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = 'https://www.google.com/maps?q=44.4180528,26.0320788&z=17&hl=ro&output=embed';
    f.title = 'Harta: Urban Blade Barber Shop, Drumul Taberei 134, București';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    box.replaceChildren(f);
  });
}

initStatus();
initPole();
initReveal();
initMap();

const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
const settle = Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]).then(
  () => Promise.race([Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 1800))])
);
settle.then(() => requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; })));
window.__app = { stripes: true };

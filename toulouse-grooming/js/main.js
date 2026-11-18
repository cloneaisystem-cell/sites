// Toulouse Grooming Studio demo. No framework, no backend.
const WA = '40744174321';
const TZ = 'Europe/Bucharest';
// day index 0 = Sunday. [open, close] in minutes.
const HOURS = { 1: [540, 1200], 2: [540, 1200], 3: [540, 1200], 4: [540, 1200], 5: [540, 1200], 6: [540, 1080], 0: [600, 900] };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- time in Bucharest (works with a pinned Date) ---------- */
function bucharestNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: dayMap[get('weekday')], min: +get('hour') * 60 + +get('minute') };
}
const fmt = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

function openStatus() {
  const { day, min } = bucharestNow();
  const [o, c] = HOURS[day];
  if (min >= o && min < c) return { state: 'open', text: `Deschis acum, până la ${fmt(c)}` };
  if (min < o) return { state: 'closed', text: `Închis acum, deschidem azi la ${fmt(o)}` };
  const nd = (day + 1) % 7;
  return { state: 'closed', text: `Închis acum, deschidem mâine la ${fmt(HOURS[nd][0])}` };
}
function paintHours() {
  const el = $('#open-now');
  const s = openStatus();
  el.dataset.state = s.state;
  el.textContent = s.text;
  const { day } = bucharestNow();
  $$('#hours tr').forEach(tr => { if (+tr.dataset.d === day) tr.setAttribute('aria-current', 'date'); });
}

/* ---------- hem print follows the section ---------- */
function hemObserver() {
  const secs = $$('[data-fabric]');
  const root = document.documentElement;
  root.dataset.f = secs[0].dataset.fabric;
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) root.dataset.f = en.target.dataset.fabric; });
  }, { rootMargin: '-35% 0px -60% 0px' });
  secs.forEach(s => io.observe(s));
}

/* ---------- gallery prints settle ---------- */
function reveal() {
  const figs = $$('.wall figure');
  if (reduce || !('IntersectionObserver' in window)) { figs.forEach(f => f.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
  figs.forEach(f => io.observe(f));
}

/* ---------- WhatsApp message builder ---------- */
const PACK = {
  full: { name: 'Full body clip', small: 160, medium: 190 },
  retouch: { name: 'Retouch (întreținere)', small: 130, medium: 160 },
  short: { name: 'Blană scurtă', small: 120, medium: 150 },
  detangle: { name: 'Descâlcit', extra: '150 lei/oră, serviciu extra' },
};
const SIZE = { small: 'mică (sub 10 kg)', medium: 'medie (10–20 kg)' };
function picker() {
  const form = $('#picker');
  const link = $('#wa-picker'), est = $('#est'), prev = $('#preview');
  const update = () => {
    const size = (form.querySelector('input[name=size]:checked') || {}).value || '';
    const pack = form.pack.value;
    const dog = form.dog.value.trim().replace(/\s+/g, ' ').slice(0, 30);
    const p = PACK[pack];
    let price = '';
    if (p && p.extra) price = p.extra;
    else if (p && size) price = `${p[size]} lei`;
    est.innerHTML = price ? `Din lista salonului: <b>${price}</b>` : 'Alege talia și pachetul ca să vezi prețul din listă.';
    let msg = `Bună ziua! Aș dori să programez toaletajul pentru ${dog || 'câinele meu'} la Toulouse Grooming Studio.`;
    if (size) msg += ` Talie: ${SIZE[size]}.`;
    if (p) msg += ` Pachet: ${p.name}.`;
    msg += ' Ce zile aveți libere?';
    link.href = `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
    prev.textContent = `Mesajul tău: „${msg}”`;
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', e => e.preventDefault());
  update();
}

/* ---------- click-to-load map ---------- */
function map() {
  const btn = $('#map-load'), box = $('#map');
  btn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.title = 'Harta: Strada Uranus 9, Brașov';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer';
    f.src = 'https://www.openstreetmap.org/export/embed.html?bbox=25.6199%2C45.6396%2C25.6359%2C45.6456&layer=mapnik&marker=45.6426996%2C25.6279349';
    box.replaceChildren(f);
  });
}

/* ---------- boot ---------- */
paintHours();
hemObserver();
reveal();
picker();
map();
setInterval(paintHours, 60000);

const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
const firstFrame = new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
// While frame-capture records, the page starts its one animation on frame 0 (window.__recordFrame), not during pre-roll.
const root = document.documentElement;
const wall = $('.wall');
window.__recordFrame = t => {
  root.classList.add('unfold-go');
  // phone video: the carousel glides sideways so every dog is seen (a person would swipe)
  if (wall && wall.scrollWidth > wall.clientWidth + 4) {
    root.classList.add('is-rec');
    const k = Math.min(1, Math.max(0, (t - 4.3) / 2.4));
    const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    wall.scrollLeft = e * (wall.scrollWidth - wall.clientWidth);
  }
};
const unfolded = new Promise(r => {
  const b = $('.half-b');
  if (reduce || !b || window.__recording) return r();
  b.addEventListener('animationend', e => { if (e.animationName === 'unfold') r(); });
  setTimeout(r, 2200);
});
Promise.all([fontsReady, firstFrame, unfolded]).then(() => { window.__ready = true; });
window.__app = { openStatus, bucharestNow };

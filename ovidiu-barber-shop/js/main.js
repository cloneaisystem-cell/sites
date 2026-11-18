// Page behaviour: the lamp (when WebGL is available and motion is allowed), the light that follows the scroll,
// the sticky header, today's row in the hours table, and the click-to-load map.
const root = document.documentElement;
const hero = document.getElementById('top');
const header = document.getElementById('header');
const roomLight = document.getElementById('roomLight');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// a frame-exact recording sets the scroll position itself: native smooth scrolling would fight it
if (new URLSearchParams(location.search).has('record') || window.__recording) root.style.scrollBehavior = 'auto';

// ---- the light that follows the page: --lx follows the sway of the lamp, --rl fades in once the hero scrolls away
let lastScroll = scrollY, heroH = hero.offsetHeight, ticking = false;
function setLightX(x) { roomLight.style.setProperty('--lx', x.toFixed(1) + 'px'); }
function onScroll() {
  const y = scrollY;
  const k = Math.min(1, Math.max(0, (y - heroH * 0.3) / (heroH * 0.55)));
  roomLight.style.setProperty('--rl', k.toFixed(3));
  header.classList.toggle('is-solid', y > 40);
  if (app && app.kick && !reduced) app.kick(-(y - lastScroll) * 0.0016);   // the lamp reacts to scroll velocity
  lastScroll = y;
  ticking = false;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', () => { heroH = hero.offsetHeight; if (!app) setLightX(innerWidth * (innerWidth / innerHeight > 1.15 ? 0.68 : 0.5)); });

// ---- the lamp
let app = null;
function staticMode() {
  root.classList.remove('gl'); root.classList.add('no-gl');
  setLightX(innerWidth * (innerWidth / innerHeight > 1.15 ? 0.68 : 0.5));
  window.__app = window.__app || { renderer: null, static: true };
  const img = hero.querySelector('.hero__static img');
  const done = () => { window.__ready = true; };
  if (img && !img.complete) { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); } else done();
}
if (root.classList.contains('gl')) {
  setLightX(innerWidth * 0.5);
  import('./lamp.js')
    .then((m) => m.startLamp({ canvas: document.getElementById('gl'), hero, photoUrl: 'img/room-1536.webp', onTick: ({ x }) => setLightX(x) }))
    .then((a) => { app = a; })
    .catch((err) => { console.warn('lamp unavailable, using the static image', err); staticMode(); });
} else {
  staticMode();
}
onScroll();

// ---- today's row (Europe/Bucharest)
try {
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Bucharest' }).format(new Date());
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd];
  const row = document.querySelector(`.hours tr[data-dow="${dow}"]`);
  if (row) { row.classList.add('is-today'); row.setAttribute('aria-current', 'date'); }
} catch (e) { /* the table reads fine without the highlight */ }

// ---- map: nothing from Google loads until the visitor asks for it
const mapBtn = document.getElementById('mapLoad');
if (mapBtn) mapBtn.addEventListener('click', () => {
  const f = document.createElement('iframe');
  f.title = 'Harta: Ovidiu Barber Shop, Bd. General Ion Dragalina 22, Timișoara';
  f.src = 'https://www.google.com/maps?q=Bd.+General+Ion+Dragalina+22,+Timi%C8%99oara&output=embed';
  f.loading = 'lazy'; f.referrerPolicy = 'no-referrer'; f.allowFullscreen = true;
  mapBtn.replaceWith(f);
});

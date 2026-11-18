import { initLang } from './i18n.js';
import { initAvail } from './avail.js';
import { initSky } from './sky.js';

const app = (window.__app = { version: 1 });
if (window.__recording) document.documentElement.classList.add('rec'); // frame-capture: Romanian date placeholder (see CSS)
initLang();
initAvail();
initSky();

// nav: solid once the hero starts to scroll away; burger on small screens
const nav = document.getElementById('nav'), links = document.getElementById('links'), burger = document.getElementById('burger');
const solid = () => nav.classList.toggle('is-solid', window.scrollY > 40);
addEventListener('scroll', solid, { passive: true });
solid();
const closeMenu = () => { links.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); };
burger.addEventListener('click', () => {
  const o = links.classList.toggle('is-open');
  burger.setAttribute('aria-expanded', String(o));
  if (o) nav.classList.add('is-solid');
});
links.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

// reveal once; the sticky phone bar steps aside while a form is on screen
const rv = [...document.querySelectorAll('.rv')];
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
  rv.forEach((el) => io.observe(el));

  const bar = document.getElementById('bar');
  const seen = new Set();
  const fo = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
    bar.classList.toggle('is-off', seen.size > 0);
  }, { threshold: 0.2 });
  document.querySelectorAll('form.avail').forEach((f) => fo.observe(f));
} else {
  rv.forEach((el) => el.classList.add('in'));
}

// the map loads only after a click
const mapBtn = document.getElementById('map-btn');
if (mapBtn) {
  mapBtn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = 'https://www.google.com/maps?q=Pensiunea+Ursule%C8%9B+Bran%2C+Strada+Principesa+Ileana+42A&output=embed';
    f.title = document.documentElement.lang === 'en' ? 'Map: Pensiunea Ursuleț, Bran' : 'Hartă: Pensiunea Ursuleț, Bran';
    f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade'; f.allowFullscreen = true;
    document.getElementById('map').replaceChildren(f);
  });
}

// ready: fonts + two frames (the dusk-to-night intro runs on CSS time, so it is in the recording)
Promise.all([
  document.fonts ? document.fonts.ready : Promise.resolve(),
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
]).then(() => { window.__ready = true; app.ready = true; });

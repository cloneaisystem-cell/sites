// Din Inimă Cofetărie · demo. No framework. ES module.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const WA = 'https://wa.me/40764663434';
const DEFAULT_MSG = 'La mulți ani, Nănuților!';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- the plaque: whatever you type is lettered on the real cake ---------- */
const cake = $('#cake');
const plaque = $('#plaque');
const sr = $('#plaque-sr');
const ctx = document.createElement('canvas').getContext('2d');
let currentText = DEFAULT_MSG;

function splitLines(t) {
  t = t.replace(/\s+/g, ' ').trim();
  const w = t.split(' ');
  if (t.length <= 15 || w.length === 1) return [t];
  let best = [t], bestW = Infinity;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(' '), b = w.slice(i).join(' ');
    const m = Math.max(a.length, b.length);
    if (m < bestW) { bestW = m; best = [a, b]; }
  }
  return best;
}
/* the plaque is placed from the photo's own geometry (object-fit: cover), so it sits on the fondant at any crop */
const PL = { l: 0.2925, t: 0.2125, w: 0.395, h: 0.104 };   // fractions of the 1200x1600 source
const cakeImg = $('#cake-img');
function placePlaque() {
  const cw = cake.clientWidth, ch = cake.clientHeight;
  if (!cw || !ch) return;
  const nw = 1200, nh = 1600;
  const sc = Math.max(cw / nw, ch / nh), rw = nw * sc, rh = nh * sc;
  const pos = (getComputedStyle(cakeImg).objectPosition || '50% 50%').split(' ').map(v => parseFloat(v) / 100);
  const ox = (cw - rw) * (isNaN(pos[0]) ? .5 : pos[0]), oy = (ch - rh) * (isNaN(pos[1]) ? .5 : pos[1]);
  Object.assign(plaque.style, { left: (ox + PL.l * rw) + 'px', top: (oy + PL.t * rh) + 'px', width: (PL.w * rw) + 'px', height: (PL.h * rh) + 'px' });
}
function fit() {
  placePlaque();
  const lines = $$('.ln', plaque).map(n => n.textContent);
  if (!lines.length) return;
  ctx.font = '100px Allura';
  const maxW = Math.max(...lines.map(l => ctx.measureText(l).width)) || 1;
  const usableW = plaque.clientWidth * 0.94;
  const usableH = plaque.clientHeight * 0.98;
  const fs = Math.min(usableW * 100 / maxW, usableH / (lines.length * 0.92), cake.clientWidth * 0.1);
  plaque.style.fontSize = fs.toFixed(1) + 'px';
}
function render(text, animate) {
  currentText = (text || '').trim() || DEFAULT_MSG;
  const lines = splitLines(currentText);
  plaque.classList.toggle('static', !animate || reduce);
  plaque.innerHTML = lines.map((l, i) => `<span class="ln" style="--delay:${(0.2 + i * 0.9).toFixed(2)}s;--dur:${Math.max(0.8, l.length * 0.07).toFixed(2)}s">${esc(l)}</span>`).join('');
  sr.textContent = lines.join(' ');
  fit();
}

/* ---------- order form → WhatsApp ---------- */
const form = $('#order');
const wa = $('#wa');
const waDock = $('#wa-dock');
const val = n => (form.elements[n].value || '').trim();
function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v + 'T12:00:00');
  return isNaN(d) ? v : d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function buildMessage() {
  const occ = form.querySelector('input[name="occasion"]:checked');
  const L = ['Bună ziua! Aș dori să comand un tort (comandă din formularul de pe site).'];
  if (occ) L.push('Ocazie: ' + occ.value);
  if (val('date')) L.push('Data: ' + fmtDate(val('date')));
  if (val('people')) L.push('Număr de persoane: ' + val('people'));
  if (val('idea')) L.push('Gust / idee: ' + val('idea'));
  if (val('msg')) L.push('Mesaj pe plăcuță: „' + val('msg') + '”');
  if (val('note')) L.push('Notă: ' + val('note'));
  L.push('Mulțumesc!');
  return L.join('\n');
}
function syncLinks() {
  const href = WA + '?text=' + encodeURIComponent(buildMessage());
  wa.href = href;
  if (waDock) waDock.href = href;
}
const dateEl = form.elements.date;
(() => { const t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); dateEl.min = t.toISOString().slice(0, 10); })();
form.addEventListener('input', e => {
  if (e.target.name === 'msg') render(e.target.value, false);
  syncLinks();
});
form.addEventListener('change', syncLinks);
form.addEventListener('submit', e => { e.preventDefault(); syncLinks(); window.open(wa.href, '_blank', 'noopener'); });
$$('.sugg button', form).forEach(b => b.addEventListener('click', () => {
  form.elements.msg.value = b.dataset.msg;
  render(b.dataset.msg, true);
  plaque.classList.add('go');
  syncLinks();
}));
syncLinks();

/* ---------- gallery tabs + lightbox ---------- */
const masonry = $('#masonry');
const tabs = $$('.seg button');
const shots = $$('.shot', masonry);
function applyTab(cat) {
  tabs.forEach(t => t.setAttribute('aria-pressed', String(t.dataset.cat === cat)));
  shots.forEach(s => { s.hidden = !(cat === 'all' || s.dataset.cat === cat); });
  if (!reduce) { masonry.classList.remove('fade'); void masonry.offsetWidth; masonry.classList.add('fade'); }
}
tabs.forEach(t => t.addEventListener('click', () => applyTab(t.dataset.cat)));

const lb = $('#lb'), lbImg = $('#lb-img'), lbCap = $('#lb-cap');
let list = [], pos = 0;
function show(i) {
  pos = (i + list.length) % list.length;
  const li = list[pos];
  lbImg.src = li.dataset.full;
  lbImg.alt = $('img', li).alt;
  lbCap.textContent = $('.cap', li).textContent;
}
shots.forEach(li => $('button', li).addEventListener('click', () => {
  list = shots.filter(s => !s.hidden);
  show(list.indexOf(li));
  lb.showModal();
}));
$('#lb-close').addEventListener('click', () => lb.close());
$('#lb-prev').addEventListener('click', () => show(pos - 1));
$('#lb-next').addEventListener('click', () => show(pos + 1));
lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-in') || e.target.classList.contains('lb-stage')) lb.close(); });
lb.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') show(pos - 1);
  if (e.key === 'ArrowRight') show(pos + 1);
});

/* ---------- hours: today highlighted, live open/closed (Europe/Bucharest) ---------- */
(() => {
  const H = { 1: null, 2: [10, 18], 3: [10, 18], 4: [10, 18], 5: [10, 18], 6: [10, 14], 0: null };
  const names = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
  const idx = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const d = idx[p.weekday], mins = (+p.hour) * 60 + (+p.minute);
  const li = $(`#hours li[data-d="${d}"]`);
  if (li) { li.classList.add('today'); li.setAttribute('aria-current', 'date'); }
  const st = $('#status'), h = H[d];
  const hh = n => String(n).padStart(2, '0') + ':00';
  if (h && mins >= h[0] * 60 && mins < h[1] * 60) { st.classList.add('open'); st.textContent = 'Acum: deschis, până la ' + hh(h[1]); return; }
  if (h && mins < h[0] * 60) { st.textContent = 'Acum: închis. Deschide azi la ' + hh(h[0]); return; }
  for (let k = 1; k <= 7; k++) { const n = (d + k) % 7; if (H[n]) { st.textContent = 'Acum: închis. Deschide ' + (k === 1 ? 'mâine' : names[n]) + ' la ' + hh(H[n][0]); return; } }
})();

/* ---------- click-to-load map ---------- */
$('#map-btn').addEventListener('click', () => {
  const box = $('#map');
  const f = document.createElement('iframe');
  f.title = 'Harta: Din Inimă Cofetărie, Str. Ioan Popasu 53, Brașov';
  f.loading = 'lazy';
  f.referrerPolicy = 'no-referrer-when-downgrade';
  f.src = 'https://www.google.com/maps?q=45.674442,25.5969377&hl=ro&z=17&output=embed';
  $('#map-load').remove();
  box.appendChild(f);
});

/* ---------- one quiet reveal per block ---------- */
const rv = $$('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  rv.forEach(n => io.observe(n));
} else rv.forEach(n => n.classList.add('in'));

/* ---------- start: fonts + hero decoded, then the lettering writes itself ---------- */
if ('ResizeObserver' in window) new ResizeObserver(fit).observe(cake);
addEventListener('resize', fit);
const img = $('#cake-img');
const start = async () => {
  try {
    await Promise.all([
      document.fonts.load('100px Allura'),
      document.fonts.load('italic 300 40px Fraunces'),
      document.fonts.load('400 17px "Hanken Grotesk"'),
      img.decode ? img.decode().catch(() => {}) : Promise.resolve()
    ]);
    await document.fonts.ready;
  } catch (e) { /* fonts fall back, page still works */ }
  fit();
  plaque.classList.add('go');
  document.documentElement.classList.add('go');
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
};
start();
setTimeout(() => { document.documentElement.classList.add('go'); plaque.classList.add('go'); if (!window.__ready) window.__ready = true; }, 4000);

/* ---------- frame-capture choreography (only with ?record=1): types a message so the lettering is seen live ---------- */
{
  const q = new URLSearchParams(location.search);
  if (q.has('record')) {
    const TEXT = 'La mulți ani, Ioana!', T0 = parseFloat(q.get('typeAt') || '3.2'), CPS = 8;
    let last = -1;
    window.__recordFrame = t => {
      if (t < T0) return;
      const n = Math.min(TEXT.length, Math.floor((t - T0) * CPS) + 1);
      if (n === last) return;
      last = n;
      const f = form.elements.msg;
      if (n === 1) f.focus({ preventScroll: true });
      f.value = TEXT.slice(0, n);
      f.dispatchEvent(new Event('input', { bubbles: true }));
    };
  }
}

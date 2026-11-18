// "Cere disponibilitate": validates, builds a Romanian message and opens WhatsApp. No backend.
const WA = '40728262209';

const fmt = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const pluralNights = n => (n === 1 ? '1 noapte' : `${n} nopți`);
const pluralAdults = n => (n === 1 ? '1 adult' : `${n} adulți`);
const pluralKids = n => (n === 0 ? 'fără copii' : n === 1 ? '1 copil' : `${n} copii`);

export function buildMessage(v) {
  const nights = Math.round((parse(v.out) - parse(v.in)) / 86400000);
  const lines = [
    'Bună ziua! Aș dori să cer disponibilitate la Panoramic Sus în Deal.',
    '',
    `Sosire: ${fmt.format(parse(v.in))}`,
    `Plecare: ${fmt.format(parse(v.out))} (${pluralNights(nights)})`,
    `Persoane: ${pluralAdults(v.adults)}, ${pluralKids(v.kids)}${v.kids > 0 && v.ages ? ` (vârste: ${v.ages})` : ''}`,
    `Cameră: ${v.room || 'oricare, mă ajutați dumneavoastră'}`,
  ];
  if (v.name) lines.push(`Nume: ${v.name}`);
  if (v.msg) lines.push('', v.msg);
  lines.push('', 'Mulțumesc!');
  return lines.join('\n');
}
export const waUrl = text => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;

export function initForm() {
  const form = document.getElementById('ask');
  if (!form) return;
  const $ = id => document.getElementById(id);
  const fin = $('f-in'), fout = $('f-out'), ad = $('f-ad'), kids = $('f-kids');
  const agesWrap = $('ages-wrap'), status = $('ask-status'), fb = $('ask-fallback'), link = $('ask-link');

  const today = new Date(); today.setHours(0, 0, 0, 0);
  fin.min = iso(today);
  const tomorrow = d => { const t = new Date(d); t.setDate(t.getDate() + 1); return t; };
  fout.min = iso(tomorrow(today));

  fin.addEventListener('change', () => {
    if (!fin.value) return;
    const min = tomorrow(parse(fin.value));
    fout.min = iso(min);
    if (!fout.value || parse(fout.value) < min) fout.value = iso(min);
    clear('in'); clear('out');
  });
  fout.addEventListener('change', () => clear('out'));

  // steppers
  form.querySelectorAll('[data-step]').forEach(b => {
    b.addEventListener('click', () => {
      const input = $(b.dataset.for);
      const step = Number(b.dataset.step);
      const min = Number(input.min), max = Number(input.max);
      input.value = Math.min(max, Math.max(min, (Number(input.value) || 0) + step));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  const clamp = i => { const n = Number(i.value); i.value = Number.isFinite(n) ? Math.min(Number(i.max), Math.max(Number(i.min), Math.round(n))) : i.min; };
  [ad, kids].forEach(i => i.addEventListener('change', () => clamp(i)));
  const syncAges = () => { agesWrap.hidden = !(Number(kids.value) > 0); };
  kids.addEventListener('input', syncAges); syncAges();

  function setErr(key, text) {
    const f = form.querySelector(`[data-f="${key}"]`);
    f.dataset.invalid = '1';
    f.querySelector('.err').textContent = text;
    f.querySelector('input,select').setAttribute('aria-invalid', 'true');
  }
  function clear(key) {
    const f = form.querySelector(`[data-f="${key}"]`);
    if (!f) return;
    delete f.dataset.invalid;
    const e = f.querySelector('.err'); if (e) e.textContent = '';
    f.querySelector('input,select')?.removeAttribute('aria-invalid');
  }
  function values() {
    return { in: fin.value, out: fout.value, adults: Number(ad.value) || 1, kids: Number(kids.value) || 0,
      ages: $('f-ages').value.trim(), room: $('f-room').value, name: $('f-name').value.trim(), msg: $('f-msg').value.trim() };
  }
  function validate(v) {
    ['in', 'out'].forEach(clear);
    let first = null;
    if (!v.in) { setErr('in', 'Alege data de sosire.'); first = fin; }
    else if (parse(v.in) < today) { setErr('in', 'Data de sosire a trecut. Alege o dată de azi încolo.'); first = fin; }
    if (!v.out) { setErr('out', 'Alege data de plecare.'); first ||= fout; }
    else if (v.in && parse(v.out) <= parse(v.in)) { setErr('out', 'Plecarea trebuie să fie după sosire.'); first ||= fout; }
    return first;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    status.textContent = '';
    fb.hidden = true;
    const v = values();
    const bad = validate(v);
    if (bad) { status.textContent = 'Mai avem nevoie de datele sejurului.'; bad.focus(); return; }
    const url = waUrl(buildMessage(v));
    link.href = url;
    fb.hidden = false;
    window.__lastWhatsAppUrl = url;
    window.open(url, '_blank', 'noopener');
  });
  window.__app = Object.assign(window.__app || {}, { buildMessage, waUrl });
}

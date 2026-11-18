// "Cere disponibilitate": validates, builds the WhatsApp message and opens wa.me. No backend.
import { getLang } from './i18n.js';

const WA = '40733802502';
const iso = (d) => d.toISOString().slice(0, 10);
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const todayRO = () => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date()); } catch (e) { return iso(new Date()); }
};
const fmt = (s, lang) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(s));

const T = {
  ro: {
    noIn: 'Alege data de sosire.',
    noOut: 'Alege data de plecare.',
    bad: 'Data de plecare trebuie să fie după data de sosire.',
    ok: 'Se deschide WhatsApp. Dacă nu se deschide, sună la 0733 802 502.',
    night: (n) => (n === 1 ? '1 noapte' : n + ' nopți'),
    room: { dubla: 'cameră dublă (22 m²)', familiala: 'cameră familială (25 m²)' },
    msg: (o) => 'Bună ziua! Aș dori să aflu disponibilitatea la Pensiunea Ursuleț din Bran.\nSosire: ' + o.in + '\nPlecare: ' + o.out + ' (' + o.nights + ')\nAdulți: ' + o.adults + (+o.children ? ' · Copii: ' + o.children : '') + (o.room ? '\nCameră: ' + o.room : '') + '\nMulțumesc!',
    table: 'Bună ziua! Aș dori să aflu dacă pot rezerva o masă la restaurantul Pensiunii Ursuleț (data, ora și numărul de persoane: ...).',
  },
  en: {
    noIn: 'Pick a check-in date.',
    noOut: 'Pick a check-out date.',
    bad: 'Check-out must be after check-in.',
    ok: 'WhatsApp is opening. If it does not, call 0733 802 502.',
    night: (n) => (n === 1 ? '1 night' : n + ' nights'),
    room: { dubla: 'double room (22 m²)', familiala: 'family room (25 m²)' },
    msg: (o) => 'Hello! I would like to ask about availability at Pensiunea Ursuleț in Bran.\nCheck-in: ' + o.in + '\nCheck-out: ' + o.out + ' (' + o.nights + ')\nAdults: ' + o.adults + (+o.children ? ' · Children: ' + o.children : '') + (o.room ? '\nRoom: ' + o.room : '') + '\nThank you!',
    table: 'Hello! I would like to ask about a table at the Pensiunea Ursuleț restaurant (date, time and number of people: ...).',
  },
};

export function waLink(text) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text); }
export function openWA(text) {
  const a = document.createElement('a');
  a.href = waLink(text); a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

export function initAvail() {
  const forms = [...document.querySelectorAll('form.avail')];
  const min = todayRO();
  const field = (f, n) => f.elements[n];
  const nights = (f) => {
    const i = field(f, 'in').value, o = field(f, 'out').value;
    return i && o ? Math.round((parse(o) - parse(i)) / 864e5) : 0;
  };
  const showNights = (f) => {
    const out = f.querySelector('.nights'); if (!out) return;
    const n = nights(f); out.textContent = n > 0 ? T[getLang()].night(n) : '';
  };
  const clearMsg = (f) => { const m = f.querySelector('.avail-msg'); if (m) { m.textContent = ''; m.classList.remove('ok'); } };

  forms.forEach((f) => {
    field(f, 'in').min = min; field(f, 'out').min = addDays(min, 1);
    f.addEventListener('input', (e) => {
      const t = e.target; if (!t.name) return;
      if (t.name === 'in' && t.value) {
        const next = addDays(t.value, 1);
        forms.forEach((g) => {
          field(g, 'out').min = next;
          if (!field(g, 'out').value || field(g, 'out').value < next) field(g, 'out').value = next;
        });
      }
      if (['in', 'out', 'adults', 'children'].includes(t.name)) forms.forEach((g) => { if (g !== f) field(g, t.name).value = t.value; });
      forms.forEach((g) => { showNights(g); clearMsg(g); });
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const l = getLang(), t = T[l], msg = f.querySelector('.avail-msg');
      const i = field(f, 'in').value, o = field(f, 'out').value;
      const fail = (text, el) => { msg.classList.remove('ok'); msg.textContent = text; el.focus(); };
      if (!i) return fail(t.noIn, field(f, 'in'));
      if (!o) return fail(t.noOut, field(f, 'out'));
      if (parse(o) <= parse(i)) return fail(t.bad, field(f, 'out'));
      const roomEl = f.querySelector('input[name=room]:checked');
      openWA(t.msg({
        in: fmt(i, l), out: fmt(o, l), nights: t.night(nights(f)),
        adults: field(f, 'adults').value, children: field(f, 'children').value,
        room: roomEl && roomEl.value ? t.room[roomEl.value] : '',
      }));
      msg.classList.add('ok'); msg.textContent = t.ok;
    });
  });
  document.addEventListener('langchange', () => forms.forEach((f) => { showNights(f); clearMsg(f); }));

  // "Cere această cameră" preselects the room type in the main form
  document.querySelectorAll('[data-room]').forEach((a) => a.addEventListener('click', () => {
    const r = document.querySelector('.avail-big input[name=room][value="' + a.dataset.room + '"]');
    if (r) r.checked = true;
  }));

  // restaurant: ask about a table
  const tw = document.getElementById('table-wa');
  if (tw) {
    const set = () => { tw.href = waLink(T[getLang()].table); };
    set(); document.addEventListener('langchange', set);
  }
}

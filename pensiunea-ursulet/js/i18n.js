// RO/EN toggle. Text is duplicated in the markup as <span data-l="ro|en">; this only flips <html lang> and swaps attributes.
const KEY = 'ursulet-lang';
const TITLES = {
  ro: 'Pensiunea Ursuleț Bran | cazare și restaurant sub Ursa Mică',
  en: 'Pensiunea Ursuleț Bran | rooms and restaurant under the Little Bear',
};
export const getLang = () => (document.documentElement.lang === 'en' ? 'en' : 'ro');
const attrs = ['alt', 'aria-label'];

export function setLang(l, persist = true) {
  l = l === 'en' ? 'en' : 'ro';
  document.documentElement.lang = l;
  document.title = TITLES[l];
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
  for (const a of attrs) {
    document.querySelectorAll('[data-en-' + a + ']').forEach((el) => {
      const ro = 'data-ro-' + a;
      if (!el.hasAttribute(ro)) el.setAttribute(ro, el.getAttribute(a) || '');
      el.setAttribute(a, l === 'en' ? el.getAttribute('data-en-' + a) : el.getAttribute(ro));
    });
  }
  if (persist) {
    try { localStorage.setItem(KEY, l); } catch (e) { /* storage blocked: fine */ }
  }
  document.dispatchEvent(new CustomEvent('langchange', { detail: l }));
}

export function initLang() {
  let l = 'ro';
  try { l = new URLSearchParams(location.search).get('lang') || localStorage.getItem(KEY) || 'ro'; } catch (e) { /* ignore */ }
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  setLang(l, false);
}

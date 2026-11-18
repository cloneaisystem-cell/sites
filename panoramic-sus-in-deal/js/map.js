// Click-to-load map (no third-party request until the visitor asks).
export function initMap() {
  const box = document.getElementById('map');
  const btn = document.getElementById('map-btn');
  if (!box || !btn) return;
  btn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = box.dataset.src;
    f.title = 'Harta: Panoramic Sus în Deal, Vișeu de Jos';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.setAttribute('allowfullscreen', '');
    box.replaceChildren(f);
  });
}

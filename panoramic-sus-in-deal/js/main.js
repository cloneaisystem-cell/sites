import { initScenes } from './scenes.js';
import { initBar } from './bar.js';
import { initMap } from './map.js';
import { initForm } from './form.js';

function setBannerHeight() {
  const b = document.querySelector('.demo-banner');
  if (b) document.documentElement.style.setProperty('--banner-h', `${Math.ceil(b.getBoundingClientRect().height)}px`);
}

async function start() {
  setBannerHeight();
  addEventListener('resize', setBannerHeight, { passive: true });
  window.__app = Object.assign(window.__app || {}, { scenes: initScenes() });
  initBar(); initMap(); initForm();
  try { await document.fonts?.ready; } catch (e) { /* fonts API optional */ }
  setBannerHeight();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

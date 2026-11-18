// The hero: the shop's black-and-white checker floor running away into black like a skin fade,
// with the red-white-navy pole turning on it. One WebGL canvas, no composer, no model files.
//   ?freeze=1  renders one frame of the resting scene (used to render the static fallback images)
//   ?record=1  exposes window.__recordFrame(t) so frame-capture can drive the camera frame-exactly
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial,
  LatheGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, BoxGeometry, Vector2, Vector3, Vector4, Color,
  CanvasTexture, SRGBColorSpace, RepeatWrapping, LinearMipmapLinearFilter, LinearFilter, FogExp2, HemisphereLight,
  DirectionalLight, PMREMGenerator, AdditiveBlending, DoubleSide, BackSide, NoToneMapping, ClampToEdgeWrapping,
} from './vendor/three.mjs';

// ---- dimensions in metres. Written down first, then built.
const TILE = 0.6;              // floor square
const TILE_ANGLE = 0.42;       // 24 degrees: the diagonals of their photos
const CAM_Y = 1.02;            // camera height
const POLE_R = 0.20;           // glass cylinder radius
const POLE_Y0 = 0.22, POLE_Y1 = 1.80;   // glass from / to
const INK = '#0C0C0E';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// four ceiling spots down the room: x, z, radius, strength
const SPOTS = [
  new Vector4(-1.7, 0.2, 2.6, 1.0),
  new Vector4(1.9, -2.7, 2.7, 0.9),
  new Vector4(-2.4, -5.6, 3.0, 0.75),
  new Vector4(2.1, -8.6, 3.2, 0.6),
];

// ---------------------------------------------------------------- floor shader
const FLOOR_VERT = /* glsl */`
  varying vec3 vW;
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const FLOOR_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uCam; uniform float uFog; uniform vec3 uFogCol; uniform vec4 uSpot[4]; uniform vec3 uPole;
  uniform float uQ; uniform float uTime;
  varying vec3 vW;
  const float TILE = ${TILE.toFixed(3)};
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 xz = vW.xz;
    float ca = cos(${TILE_ANGLE.toFixed(3)}), sa = sin(${TILE_ANGLE.toFixed(3)});
    vec2 p = vec2(ca * xz.x - sa * xz.y, sa * xz.x + ca * xz.y) / TILE;

    // box-filtered checker: far squares average to grey, then the fog takes them. That is the fade.
    vec2 w = max(abs(dFdx(p)), abs(dFdy(p))) + 0.0005;
    vec2 q = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
    float chk = 0.5 - 0.5 * q.x * q.y;
    chk = mix(chk, 0.5, smoothstep(0.55, 1.1, max(w.x, w.y)));   // filter wider than a tile: plain grey

    // grout, gone before it can shimmer
    vec2 fp = abs(fract(p) - 0.5);
    float edge = max(fp.x, fp.y);
    float gfade = 1.0 - smoothstep(0.015, 0.12, max(w.x, w.y));
    float grout = smoothstep(0.5 - 0.010 - w.x * 0.6, 0.5 - 0.002, edge) * gfade;

    // marble speckle and a soft vein on the white tiles, almost nothing on the black ones
    float sfade = 1.0 - smoothstep(0.02, 0.10, max(w.x, w.y));
    float spk = mix(0.5, vnoise(p * 7.0) * 0.5 + vnoise(p * 19.0) * 0.5, sfade);
    float vein = smoothstep(0.46, 0.5, abs(vnoise(p * 1.7 + 3.0) - 0.5) + 0.4) * 0.0;
    vec3 white = vec3(0.70, 0.68, 0.64) * (0.88 + 0.16 * spk);
    vec3 black = vec3(0.016, 0.016, 0.018) * (0.8 + 0.8 * spk);
    vec3 alb = mix(black, white, chk);
    alb = mix(alb, vec3(0.05, 0.05, 0.055), grout * 0.85);

    // light: dim room, four ceiling spots
    vec3 warm = vec3(1.0, 0.94, 0.84);
    float pool = 0.0;
    for (int k = 0; k < 4; k++) { vec2 d = (xz - uSpot[k].xy) / uSpot[k].z; pool += uSpot[k].w * exp(-dot(d, d) * 1.5); }
    vec3 lit = alb * (vec3(0.022, 0.022, 0.026) + warm * pool * 1.55);

    // the pole spills red and navy onto the tiles on either side
    vec2 dr = xz - (uPole.xz + vec2(0.62, 0.30)); vec2 dn = xz - (uPole.xz + vec2(-0.58, 0.05));
    float rr = exp(-dot(dr, dr) * 1.15), nn = exp(-dot(dn, dn) * 1.05);
    lit += alb * (vec3(1.0, 0.09, 0.09) * rr * 0.62 + vec3(0.12, 0.24, 1.0) * nn * 0.70) * (0.55 + 0.45 * chk);

    // gloss: the ceiling spots mirrored in the floor, stretched towards the viewer
    vec3 toCam = uCam - vW; float dist = length(toCam); vec3 V = toCam / dist;
    float fres = 0.22 + 0.78 * pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
    float gloss = mix(1.0, 0.38, chk) * fres;
    vec3 spec = vec3(0.0);
    if (uQ > 0.5) {
      for (int k = 0; k < 4; k++) {
        float t = uCam.y / (uCam.y + 3.0);
        vec2 p0 = uCam.xz + t * (uSpot[k].xy - uCam.xz);
        vec2 dir = normalize(p0 - uCam.xz);
        vec2 d = xz - p0;
        float along = dot(d, dir), across = dot(d, vec2(-dir.y, dir.x));
        float sa2 = 0.11 + 0.018 * dist, sl2 = 0.55 + 0.30 * dist;
        spec += warm * uSpot[k].w * exp(-(across * across) / (sa2 * sa2) - (along * along) / (sl2 * sl2));
      }
    }
    vec3 col = lit + spec * gloss * 0.95;

    float f = 1.0 - exp(-pow(dist * uFog, 2.0));
    col = mix(col, uFogCol, f);
    col = col / (1.0 + col * 0.22);

    // black tiles reflect the pole more than white ones; far away the reflection is gone
    float alpha = mix(0.66, 0.90, chk);
    alpha = mix(alpha, 1.0, smoothstep(2.2, 4.6, length(xz - uPole.xz)));
    alpha = mix(alpha, 1.0, f);
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
    gl_FragColor.rgb += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;   // dither after the sRGB step, so the dark fade does not band
  }`;

// ---------------------------------------------------------------- textures
function stripeTexture() {
  // 512 x 1024; (x + y) mod 256 picks the band, and the shift across the width is two periods,
  // so the helix closes round the cylinder. Rotating the cylinder makes the stripes climb.
  const c = document.createElement('canvas'); c.width = 512; c.height = 1024;
  const g = c.getContext('2d'); const im = g.createImageData(512, 1024); const d = im.data;
  const cols = [[236, 232, 224], [214, 40, 47], [236, 232, 224], [27, 42, 98]];
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 512; x++) {
    const ph = (y + x) % 256; let band = Math.floor(ph / 64);
    // soft 2 px edges between bands
    const into = ph % 64; const col = cols[band]; let r = col[0], gg = col[1], b = col[2];
    if (into < 2) { const pc = cols[(band + 3) % 4]; const t = 0.5 + into / 4; r = pc[0] * (1 - t) + r * t; gg = pc[1] * (1 - t) + gg * t; b = pc[2] * (1 - t) + b * t; }
    const k = (y * 512 + x) * 4; d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = RepeatWrapping; t.wrapT = RepeatWrapping;
  t.anisotropy = 8; t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter; return t;
}
function glossTexture() {
  // two soft vertical highlights, painted into a transparent strip texture (u runs round the glass)
  const c = document.createElement('canvas'); c.width = 256; c.height = 4;
  const g = c.getContext('2d'); g.clearRect(0, 0, 256, 4);
  const strip = (cx, w, a) => { const gr = g.createLinearGradient(cx - w, 0, cx + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(cx - w, 0, w * 2, 4); };
  strip(64, 12, 0.95); strip(92, 4, 0.55); strip(214, 10, 0.32);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = RepeatWrapping; return t;
}
function checkerCanvasTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#0b0b0c' : '#cfccc5'; g.fillRect(x * 32, y * 32, 32, 32); }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(3, 3); return t;
}

// ---------------------------------------------------------------- the pole (built once, instanced twice: real + mirror)
function buildPole(env) {
  const g = new Group();
  const chrome = new MeshStandardMaterial({ color: 0xd9d9dc, metalness: 1.0, roughness: 0.16, envMap: env, envMapIntensity: 2.2 });
  const darkChrome = new MeshStandardMaterial({ color: 0x8a8a90, metalness: 1.0, roughness: 0.34, envMap: env, envMapIntensity: 0.9 });
  const prof = (pts) => new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 56);
  // base: wide foot, stepped, a collar under the glass
  const base = new Mesh(prof([[0.0, 0.0], [0.34, 0.0], [0.345, 0.012], [0.335, 0.03], [0.30, 0.055], [0.30, 0.075], [0.255, 0.10], [0.255, 0.14], [0.235, 0.165], [0.235, 0.19], [0.215, 0.205], [0.215, POLE_Y0], [0.0, POLE_Y0]]), chrome);
  g.add(base);
  const foot = new Mesh(prof([[0.30, 0.075], [0.33, 0.075], [0.33, 0.062], [0.30, 0.062]]), darkChrome); g.add(foot);
  // glass: striped cylinder (spins) with an inner dark backing so the back wall reads through it
  const stripes = stripeTexture();
  const glassMat = new MeshStandardMaterial({ map: stripes, emissiveMap: stripes, emissive: 0xffffff, emissiveIntensity: 0.42, roughness: 0.22, metalness: 0.0, envMap: env, envMapIntensity: 0.55 });
  const glass = new Mesh(new CylinderGeometry(POLE_R, POLE_R, POLE_Y1 - POLE_Y0, 72, 1, true), glassMat);
  glass.position.y = (POLE_Y0 + POLE_Y1) / 2; g.add(glass);
  const backing = new Mesh(new CylinderGeometry(POLE_R * 0.985, POLE_R * 0.985, POLE_Y1 - POLE_Y0, 40, 1, true), new MeshBasicMaterial({ color: 0x120c0d, side: BackSide }));
  backing.position.y = glass.position.y; g.add(backing);
  // glass highlights stay put while the stripes turn
  const hi = new Mesh(new CylinderGeometry(POLE_R * 1.012, POLE_R * 1.012, POLE_Y1 - POLE_Y0, 64, 1, true),
    new MeshBasicMaterial({ map: glossTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.85 }));
  hi.position.y = glass.position.y; hi.rotation.y = -0.55; g.add(hi);
  // cap: collar, shoulder, dome, finial ball
  const cap = new Mesh(prof([[0.215, POLE_Y1], [0.235, POLE_Y1 + 0.012], [0.235, POLE_Y1 + 0.04], [0.255, POLE_Y1 + 0.06], [0.255, POLE_Y1 + 0.085], [0.235, POLE_Y1 + 0.11], [0.20, POLE_Y1 + 0.145], [0.15, POLE_Y1 + 0.185], [0.09, POLE_Y1 + 0.215], [0.04, POLE_Y1 + 0.228], [0.0, POLE_Y1 + 0.23]]), chrome);
  g.add(cap);
  const ball = new Mesh(new SphereGeometry(0.058, 28, 20), chrome); ball.position.y = POLE_Y1 + 0.285; g.add(ball);
  const neck = new Mesh(new CylinderGeometry(0.02, 0.03, 0.05, 16), darkChrome); neck.position.y = POLE_Y1 + 0.245; g.add(neck);
  g.userData.spin = glass;
  g.userData.stripes = stripes;
  return g;
}

function buildEnv(renderer) {
  // a tiny studio the chrome can reflect: black room, a ceiling row of spots, a soft box, a warm strip, the checker floor
  const s = new Scene(); s.background = new Color(0x050506);
  const emit = (hex, i) => new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(i) });
  const box = (w, h, d, x, y, z, hex, i, ry = 0) => { const m = new Mesh(new BoxGeometry(w, h, d), emit(hex, i)); m.position.set(x, y, z); m.rotation.y = ry; s.add(m); };
  for (let i = -3; i <= 3; i++) for (let j = 0; j < 3; j++) box(0.35, 0.05, 0.35, i * 2.2, 5, -j * 4 - 1, 0xfff1dc, 14);
  box(0.4, 3.4, 6.5, -7, 1.4, 1.5, 0xffffff, 7);
  box(6, 0.3, 3, 0, 4.2, 3.5, 0xffffff, 4);
  box(0.3, 2.8, 4, 7, 1.0, -2, 0xffd9b0, 1.7);
  box(9, 0.9, 0.2, 0, 1.2, -9, 0xb85a42, 0.5);
  const fl = new Mesh(new PlaneGeometry(40, 40), new MeshBasicMaterial({ map: checkerCanvasTex() })); fl.rotation.x = -Math.PI / 2; fl.position.y = -0.01; s.add(fl);
  const pm = new PMREMGenerator(renderer); const tex = pm.fromScene(s, 0.035).texture; pm.dispose();
  s.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return tex;
}

// ---------------------------------------------------------------- the app
export async function startFloor({ canvas, hero, onReady }) {
  const params = new URLSearchParams(location.search);
  const freeze = params.has('freeze'), recording = params.has('record') || !!window.__recording;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: freeze || recording });
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(new Color(INK), 1);
  const maxDpr = recording ? 3 : coarse ? 1.5 : 2;   // a recording renders at the true pixel ratio, a phone is capped at 1.5
  let dpr = Math.min(devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  scene.fog = new FogExp2(new Color(INK), 0.095);
  const camera = new PerspectiveCamera(36, 1, 0.1, 80);
  const env = buildEnv(renderer);
  scene.environment = env; scene.environmentIntensity = 0.9;

  scene.add(new HemisphereLight(0x8a8a96, 0x08080a, 0.35));
  const key = new DirectionalLight(0xfff0dc, 1.35); key.position.set(-3.2, 4.0, 4.5); scene.add(key);
  const rim = new DirectionalLight(0xff6a5a, 0.35); rim.position.set(3.5, 1.6, -2.0); scene.add(rim);

  const pole = buildPole(env);
  const mirror = buildPole(env); mirror.scale.y = -1;
  mirror.userData.stripes.dispose(); mirror.userData.spin.material.map = pole.userData.stripes; mirror.userData.spin.material.emissiveMap = pole.userData.stripes;
  const polePos = new Vector3(1.25, 0, 0.9);
  const poleRoot = new Group(); poleRoot.add(pole); scene.add(poleRoot);
  const mirrorRoot = new Group(); mirrorRoot.add(mirror); scene.add(mirrorRoot);

  const floorMat = new ShaderMaterial({
    vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, transparent: true, depthWrite: true,
    uniforms: {
      uCam: { value: new Vector3() }, uFog: { value: 0.095 }, uFogCol: { value: new Color(INK) }, uSpot: { value: SPOTS },
      uPole: { value: polePos.clone() }, uQ: { value: 1 }, uTime: { value: 0 },
    },
  });
  floorMat.uniforms.uFogCol.value = new Color(INK);   // Color(hex) is converted to linear, like the clear colour
  const floor = new Mesh(new PlaneGeometry(70, 70), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -26); scene.add(floor);

  // ---- layout: pole to the right third on wide screens, centred and larger on a phone
  let aspect = 1.6, scroll = 0, kick = 0, spin = 0.9, tNow = 0, lookY = 1.42, poleScale = 1;
  const sway = { x: 0, y: 0 };
  function layout() {
    const w = hero.clientWidth || innerWidth, h = hero.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    aspect = w / h; camera.aspect = aspect;
    if (aspect > 1.15) { camera.fov = 36; polePos.set(1.35 + clamp(aspect - 1.6, -0.4, 0.8) * 0.5, 0, -0.55); }
    else { camera.fov = 36 + clamp((1.15 - aspect) * 62, 0, 30); polePos.set(0.62, 0, -1.25); }
    camera.updateProjectionMatrix();
    lookY = aspect > 1.15 ? 1.42 : 1.30; poleScale = 1;
    if (aspect <= 1.15) fitPortrait(h);
    poleRoot.position.copy(polePos); mirrorRoot.position.copy(polePos);
    poleRoot.scale.setScalar(poleScale); mirrorRoot.scale.setScalar(poleScale);
    floorMat.uniforms.uPole.value.copy(polePos);
    needs = true;
  }

  // phones differ a lot in height: fit the pole into the free band between the lede and the rating line
  const _v = new Vector3();
  function fitPortrait(h) {
    const hr = hero.getBoundingClientRect();
    let lede = hero.querySelector('.hero__lede'); const rating = hero.querySelector('.hero__rating');
    if (lede && !lede.offsetParent) lede = hero.querySelector('.hero__title');   // very short phones hide the lede
    if (!lede || !rating || !hr.height) return;
    const top = lede.getBoundingClientRect().bottom - hr.top + 14, bottom = rating.getBoundingClientRect().top - hr.top - 8;
    if (bottom - top < 120) return;
    const proj = (y) => { _v.set(polePos.x, y, polePos.z).project(camera); return (1 - _v.y) / 2 * h; };
    const aim = () => { camera.position.set(-0.15, CAM_Y, 4.5); camera.lookAt(0.15, lookY, -4.0); camera.updateMatrixWorld(); };
    // 1. pitch: the pole's foot goes to the bottom of the band (higher look-at = lower on screen)
    let lo = 0.6, hi = 3.4;
    for (let i = 0; i < 18; i++) { lookY = (lo + hi) / 2; aim(); if (proj(0) > bottom) hi = lookY; else lo = lookY; }
    // 2. scale: grow or shrink the pole from its foot until the cap just clears the lede
    poleScale = 1; aim();
    const full = proj(0) - proj(2.3 * poleScale);
    const room = proj(0) - top;
    poleScale = clamp(room * 0.95 / full, 0.55, 1.5);   // fill the band, never reach into the lede
  }

  function place(t) {
    // camera: low, long lens, a slow sway; scrolling walks the camera forward over the floor
    const s = smooth(0, 1, scroll);
    const sx = reduced ? 0 : Math.sin(t * 0.21) * 0.10, sy = reduced ? 0 : Math.sin(t * 0.17 + 1.3) * 0.012;
    const portrait = aspect <= 1.15;
    const cz = (portrait ? 4.5 : 5.6) - s * 3.4, cy = CAM_Y - s * 0.30 + sy, cx = -0.15 + sx - s * 0.2;
    camera.position.set(cx, cy, cz);
    camera.lookAt(0.15 + sx * 0.5, lookY - s * 0.5, -4.0);
    floorMat.uniforms.uCam.value.copy(camera.position);
    floorMat.uniforms.uTime.value = freeze ? 0.0 : (t % 7.0);
    poleRoot.rotation.y = 0; pole.userData.spin.rotation.y = spin;
    mirror.userData.spin.rotation.y = spin;
  }

  let needs = true, visible = true, last = performance.now(), slow = 0, frames = 0, tier = 1;
  function render(t) {
    place(t);
    renderer.render(scene, camera);
    needs = false;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (recording) return;                       // frame-capture calls __recordFrame itself
    if (!visible || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tNow += dt;
    if (!reduced && !freeze) { kick *= Math.exp(-dt * 2.4); spin += dt * (TAU / 9 + kick); needs = true; }
    if (needs) {
      const t0 = performance.now(); render(tNow); const ms = performance.now() - t0 + dt * 0;
      frames++; if (frames > 20) { slow += dt * 1000 > 30 ? 1 : 0; }
      if (tier === 1 && frames === 110 && slow > 70) { tier = 0; mirror.visible = false; floorMat.uniforms.uQ.value = 0; if (dpr > 1) { dpr = 1; renderer.setPixelRatio(1); layout(); } }
    }
  }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) needs = true; }).observe(hero);
  addEventListener('resize', layout);
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); });   // text metrics change when the fonts land
  if (freeze) { spin = 0.55; tNow = 2.0; scroll = 0; }
  render(tNow);
  requestAnimationFrame(frame);

  const app = {
    renderer, canvas,
    setScroll(p) { const v = clamp(p, 0, 1); if (Math.abs(v - scroll) > 1e-4) { scroll = v; needs = true; } },
    kick(v) { if (!reduced) kick = clamp(kick + v, -1.2, 5.0); },
  };
  window.__app = app;
  if (recording) {
    window.__recordFrame = (t) => { tNow = t; spin = 0.9 + t * (TAU / 9); render(t); };
  }
  // first frame is on the canvas: let the page (and site-check / frame-capture) know
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; onReady && onReady(); }));
  return app;
}

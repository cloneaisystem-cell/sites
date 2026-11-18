// The hero lamp: a procedural industrial pendant (lathe shade, cable, bulb) hanging over the salon photo.
// One WebGL canvas: a full-screen backdrop pass (photo + light pool that follows the swaying lamp),
// then the lamp meshes, then a soft additive halo. No composer, no model files.
//   ?freeze=1  renders one frame of the resting, switched-on lamp (used to render the static fallback)
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial,
  LatheGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, TubeGeometry, CatmullRomCurve3, BufferGeometry,
  Float32BufferAttribute, Vector2, Vector3, HemisphereLight, DirectionalLight, TextureLoader, SRGBColorSpace,
  LinearFilter, AdditiveBlending, BackSide, Color,
} from './vendor/three.mjs';

// ---- dimensions, in "lamp units" (shade diameter = 1). Written down first, then built.
const SHADE_R = 0.5;        // rim radius
const SHADE_H = 0.44;       // apex to rim
const CABLE_L = 3.4;        // pivot to apex (the pivot sits above the top edge of the screen)
const BULB_R = 0.088;
const BULB_Y = -SHADE_H + 0.085;   // bulb centre, measured from the apex, just inside the rim
const IMG_W = 1536, IMG_H = 2048;  // the room photo

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- shaders
const FULLSCREEN_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Backdrop: the photo, nearly dark, lit by one pendant. Light leaves through the open rim as a cone,
// so the pool is wide below the bulb and almost nothing spills upward past the shade.
const BACKDROP_FRAG = /* glsl */`
  uniform sampler2D uTex; uniform vec4 uWin; uniform vec2 uBulb; uniform float uPool; uniform float uOn; uniform float uTime; uniform float uQ;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 tex = texture2D(uTex, uWin.xy + vUv * uWin.zw).rgb;
    vec2 d = (gl_FragCoord.xy - uBulb) / uPool;
    float below = smoothstep(0.10, -0.12, d.y);                       // 1 under the rim, 0 above the bulb
    float ang = atan(abs(d.x), max(-d.y, 0.004));                      // angle from the shade axis
    float cone = smoothstep(1.42, 0.30, ang);
    float dist = length(vec2(d.x * 0.86, d.y * 0.80));
    float pool = cone * below * (exp(-dist * dist * 1.7) * 0.95 + 0.34 / (1.0 + dist * dist * 6.0));
    float spill = exp(-dot(d, d) * 7.0) * 0.11;                        // a little light on the ceiling around the shade
    float haze = (cone * below * exp(-dist * dist * 1.1) + spill) * 0.052 * uQ;
    vec3 warm = vec3(1.0, 0.64, 0.30);
    vec3 amb = vec3(0.42, 0.62, 0.60) * 0.105;                        // the graphite-teal wall in the dark
    vec3 col = tex * (amb + warm * (pool + spill * 0.6) * 1.55 * uOn) + warm * haze * uOn;
    col = col / (1.0 + col * 0.30);
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;                      // dither, so the dark gradients do not band
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

const HALO_FRAG = /* glsl */`
  uniform vec2 uBulb; uniform float uR; uniform float uOn;
  void main() {
    vec2 d = (gl_FragCoord.xy - uBulb) / uR;
    d.y = d.y > 0.0 ? d.y * 2.6 : d.y * 0.85;                          // glow bleeds down through the rim, little over the shade
    float r2 = dot(d, d);
    float g = 0.56 * exp(-r2 * 10.0) + 0.25 * exp(-r2 * 2.4) + 0.05 / (1.0 + r2 * 9.0);
    gl_FragColor = vec4(vec3(1.0, 0.69, 0.33) * g * uOn, 1.0);
    #include <colorspace_fragment>
  }`;

// inside of the shade: pale enamel, brightest where it is closest to the bulb
const INTERIOR_VERT = /* glsl */`
  varying vec3 vP;
  void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const INTERIOR_FRAG = /* glsl */`
  uniform vec3 uBulbL; uniform float uOn;
  varying vec3 vP;
  void main() {
    float d = distance(vP, uBulbL);
    float k = 0.20 + 1.35 / (1.0 + d * d * 11.0);
    vec3 col = mix(vec3(0.16, 0.12, 0.09), vec3(1.0, 0.80, 0.52), clamp(k * uOn, 0.0, 1.2));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

// ---------------------------------------------------------------- geometry
function shadeProfile() {
  // a domed warehouse shade: shoulders swell quickly under the neck, sides straighten toward the rim
  const pts = [];
  const N = 30, r0 = 0.07;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = r0 + (SHADE_R - r0) * (1 - Math.pow(1 - t, 2.05));
    pts.push(new Vector2(r, -SHADE_H * t));
  }
  return pts.reverse();                    // rim first, apex last: front faces point outward
}
function build(on) {
  const g = new Group();                   // origin = the pivot; everything hangs below it
  const metal = new MeshStandardMaterial({ color: 0x0c0e0e, roughness: 0.42, metalness: 0.55 });
  const rimMat = new MeshStandardMaterial({ color: 0x111313, roughness: 0.35, metalness: 0.6, emissive: 0x3a1c08, emissiveIntensity: 0.0 });
  const cord = new MeshStandardMaterial({ color: 0x070808, roughness: 0.85, metalness: 0.0 });

  // exposed cable, thin and black
  const cable = new Mesh(new CylinderGeometry(0.0062, 0.0062, CABLE_L + 0.02, 6, 1), cord);
  cable.position.y = -CABLE_L / 2 + 0.01;
  g.add(cable);

  const shadeGroup = new Group();
  shadeGroup.position.y = -CABLE_L;        // apex
  g.add(shadeGroup);

  const prof = shadeProfile();
  const outer = new Mesh(new LatheGeometry(prof, 72), metal);
  shadeGroup.add(outer);
  const inner = new Mesh(new LatheGeometry(prof, 72), new ShaderMaterial({
    vertexShader: INTERIOR_VERT, fragmentShader: INTERIOR_FRAG, side: BackSide, toneMapped: false,
    uniforms: { uBulbL: { value: new Vector3(0, BULB_Y, 0) }, uOn: on },
  }));
  inner.scale.set(0.985, 1.0, 0.985); inner.position.y = -0.004;
  shadeGroup.add(inner);

  const lip = new Mesh(new TorusGeometry(SHADE_R + 0.004, 0.0105, 10, 96), rimMat);
  lip.rotation.x = Math.PI / 2; lip.position.y = -SHADE_H;
  shadeGroup.add(lip);

  // neck: cord grip with three ribs, then a collar on the shade
  const grip = new Mesh(new CylinderGeometry(0.034, 0.034, 0.17, 20), metal); grip.position.y = 0.075; shadeGroup.add(grip);
  for (let i = 0; i < 3; i++) {
    const rib = new Mesh(new CylinderGeometry(0.05, 0.05, 0.016, 24), metal); rib.position.y = 0.02 + i * 0.045; shadeGroup.add(rib);
  }
  const collar = new Mesh(new CylinderGeometry(0.082, 0.098, 0.04, 28), metal); collar.position.y = -0.018; shadeGroup.add(collar);

  // socket, bulb, filament
  const sockTop = -0.04, sockBottom = BULB_Y + BULB_R * 1.18 - 0.012;
  const socket = new Mesh(new CylinderGeometry(0.043, 0.043, sockTop - sockBottom, 18), metal);
  socket.position.y = (sockTop + sockBottom) / 2; shadeGroup.add(socket);
  const bulb = new Group(); bulb.position.y = BULB_Y; shadeGroup.add(bulb);
  const glass = new Mesh(new SphereGeometry(BULB_R, 28, 18), new MeshBasicMaterial({ color: new Color(1.0, 0.74, 0.40), transparent: true, opacity: 0.62, toneMapped: false }));
  glass.scale.set(1, 1.18, 1); bulb.add(glass);
  const core = new Mesh(new SphereGeometry(BULB_R * 0.52, 20, 12), new MeshBasicMaterial({ color: new Color(1.0, 0.95, 0.80), toneMapped: false }));
  core.scale.set(1, 1.3, 1); bulb.add(core);
  const helix = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU * 5; helix.push(new Vector3(Math.cos(a) * 0.024, (i / 40 - 0.5) * 0.085, Math.sin(a) * 0.024)); }
  const coil = new Mesh(new TubeGeometry(new CatmullRomCurve3(helix), 64, 0.0028, 5, false), new MeshBasicMaterial({ color: new Color(1.0, 1.0, 0.92), toneMapped: false }));
  bulb.add(coil);

  return { group: g, bulb, rimMat, inner };
}
function fullscreenTriangle() {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return geo;
}

// ---------------------------------------------------------------- pendulum
class Pendulum {
  constructor() { this.a = 0; this.w = 0; }
  kick(v) { this.w = clamp(this.w + v, -0.9, 0.9); }
  step(dt, t) {
    // slow ambient sway (about +-3 deg), a spring that follows it, and impulses from scrolling
    const target = 0.052 * (0.7 * Math.sin(t * TAU / 7.4) + 0.3 * Math.sin(t * TAU / 4.3 + 1.3));
    const k = 3.7, c = 1.05;
    this.w += (-k * (this.a - target) - c * this.w) * dt;
    this.a = clamp(this.a + this.w * dt, -0.17, 0.17);
  }
}

// ---------------------------------------------------------------- start
export async function startLamp({ canvas, hero, photoUrl, onTick }) {
  const params = new URLSearchParams(location.search);
  const FREEZE = params.has('freeze');
  const RECORD = params.has('record');             // frame-exact recording: no adaptive quality, full pixel ratio

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: FREEZE, stencil: false });
  // pixel ratio: 2 on desktop, 1.5 on phones and coarse pointers (the backdrop is a soft, dark photo, so the cap costs nothing visible)
  const lowPower = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  let dpr = Math.min(devicePixelRatio || 1, RECORD ? 3 : lowPower ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x141c1b, 1);

  const scene = new Scene();
  const FOV = 40, DIST = 3.2;
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 40);
  camera.position.set(0, 0, DIST);

  scene.add(new HemisphereLight(0x9db5b0, 0x5a3820, 0.55));
  const bounce = new DirectionalLight(0xffb15c, 1.5); bounce.position.set(0.8, -3, 2.2); scene.add(bounce);
  const rim = new DirectionalLight(0x9fc0ba, 0.9); rim.position.set(-3, 2.2, 1.6); scene.add(rim);

  const onUniform = { value: 0 };
  const lamp = build(onUniform);
  scene.add(lamp.group);

  // backdrop (first) and halo (last), both full-screen triangles with no depth
  const tex = await new Promise((res, rej) => new TextureLoader().load(photoUrl, res, undefined, rej));
  tex.colorSpace = SRGBColorSpace; tex.minFilter = LinearFilter; tex.generateMipmaps = false;
  const backdropMat = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERT, fragmentShader: BACKDROP_FRAG, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uTex: { value: tex }, uWin: { value: [0, 0, 1, 1] }, uBulb: { value: new Vector2() }, uPool: { value: 500 }, uOn: onUniform, uTime: { value: 0 }, uQ: { value: 1 } },
  });
  const backdrop = new Mesh(fullscreenTriangle(), backdropMat);
  backdrop.frustumCulled = false; backdrop.renderOrder = -10; scene.add(backdrop);
  const haloMat = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERT, fragmentShader: HALO_FRAG, depthTest: false, depthWrite: false, transparent: true, blending: AdditiveBlending, toneMapped: false,
    uniforms: { uBulb: backdropMat.uniforms.uBulb, uR: { value: 120 }, uOn: onUniform },
  });
  const halo = new Mesh(fullscreenTriangle(), haloMat);
  halo.frustumCulled = false; halo.renderOrder = 10; scene.add(halo);

  // ---- layout: where the lamp hangs on this viewport, how big it is, which part of the photo shows
  let W = 1, H = 1, arm = 0, baseX = 0, lampScale = 1;
  const v3 = new Vector3();
  function photoWindow(aspect) {
    const phone = aspect < 0.9;
    let vh = phone ? 0.59 : (IMG_W / aspect) / IMG_H;
    let uw = vh * IMG_H * aspect / IMG_W;
    if (uw > 1) { uw = 1; vh = uw * IMG_W / (IMG_H * aspect); }
    const cx = phone ? 0.60 : 0.5;
    const u0 = clamp(cx - uw / 2, 0, 1 - uw);
    const top = clamp(phone ? 0.41 : 0.43, 0, 1 - vh);
    return [u0, 1 - (top + vh), uw, vh];
  }
  function layout() {
    const r = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const halfH = DIST * Math.tan(FOV * Math.PI / 360);
    const pxPerUnit = H / (2 * halfH);
    const wide = W / H > 1.15;
    const ndcX = wide ? 0.36 : 0.0;
    const ndcY = wide ? 0.34 : 0.40;                 // where the rim sits
    const shadePx = wide ? clamp(H * 0.33, 190, 310) : clamp(W * 0.46, 150, 230);
    lampScale = shadePx / (SHADE_R * 2 * pxPerUnit);
    const rimX = ndcX * halfH * camera.aspect, rimY = ndcY * halfH;
    lamp.group.scale.setScalar(lampScale);
    lamp.group.position.set(rimX, rimY + (CABLE_L + SHADE_H) * lampScale, 0);
    arm = (CABLE_L + SHADE_H - 0.085) * lampScale * pxPerUnit;   // pivot to bulb, in CSS px
    baseX = (ndcX * 0.5 + 0.5) * W;
    backdropMat.uniforms.uWin.value = photoWindow(W / H);
    backdropMat.uniforms.uPool.value = (wide ? H * 0.70 : H * 0.50) * dpr;
    haloMat.uniforms.uR.value = shadePx * 0.62 * dpr;
    app.layout = { W, H, wide, shadePx, arm, baseX };
  }

  let t0 = performance.now() / 1000, last = t0;
  const pend = new Pendulum();
  const app = { renderer, scene, camera, lamp, backdropMat, pendulum: pend, layout: null, kick: (v) => pend.kick(v), msPerFrame: 0, tier: 0, setDpr: null };
  window.__app = app;

  function project() {
    camera.updateMatrixWorld();                      // the first frame has no inverse matrix yet
    lamp.bulb.getWorldPosition(v3).project(camera);
    backdropMat.uniforms.uBulb.value.set((v3.x * 0.5 + 0.5) * W * dpr, (v3.y * 0.5 + 0.5) * H * dpr);
  }
  function drawFrame(t) {
    lamp.group.rotation.z = pend.a;
    lamp.group.updateMatrixWorld(true);
    project();
    backdropMat.uniforms.uTime.value = t;
    renderer.render(scene, camera);
  }
  // "the light comes on": a short flicker, then steady
  const switchOn = (s) => {
    if (s < 0.4) return 0;
    const t = s - 0.4, keys = [[0, 0], [0.05, 0.85], [0.1, 0.1], [0.19, 0.7], [0.24, 0.25], [0.31, 0.95], [0.38, 0.55], [0.7, 1]];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return v0 + (v1 - v0) * (t - t0) / (t1 - t0); }
    return 1;
  };

  app.setDpr = (v) => { dpr = v; layout(); drawFrame(last - t0); };
  layout();
  if (FREEZE) {
    onUniform.value = 1; pend.a = 0; drawFrame(0);
    window.__ready = true;
    return app;
  }

  // ---- adaptive quality, without ever resizing the canvas (some engines blank a WebGL canvas that is resized at runtime):
  //   tier 0 = full, 1 = no glow pass and no haze, 2 = also draw every second frame
  let tier = 0, winSum = 0, winN = 0, skip = false;
  function setTier(n) { tier = app.tier = n; halo.visible = n < 1; backdropMat.uniforms.uQ.value = n < 1 ? 1 : 0; }

  // ---- loop: always ticks the pendulum (the page light follows it), renders only while the hero is on screen
  let visible = true, frames = 0, readyAt = null;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(hero);
  new ResizeObserver(() => { layout(); if (visible) drawFrame(last - t0); }).observe(hero);
  let lastX = -1;
  function frame(nowMs) {
    const now = nowMs / 1000, raw = now - last, dt = Math.min(raw, 1 / 30); last = now;
    const t = now - t0;
    onUniform.value = switchOn(t) * (1 - 0.018 * (0.5 + 0.5 * Math.sin(t * 2.3)) * smooth(1.2, 2.0, t));
    pend.step(dt, t);
    const x = baseX + Math.sin(pend.a) * arm;
    if (onTick && Math.abs(x - lastX) > 0.2) { lastX = x; onTick({ x, on: onUniform.value }); }
    if (visible && !document.hidden) {
      if (tier < 2 || (skip = !skip)) drawFrame(t);
      frames++;
      if (frames > 30 && raw < 0.25) {            // ignore start-up and tab switches; judge 90-frame windows
        winSum += raw;
        if (++winN === 90) {
          app.msPerFrame = winSum / winN * 1000;
          if (!RECORD && app.msPerFrame > 30 && tier < 2) setTier(tier + 1);
          winSum = 0; winN = 0;
        }
      }
      if (readyAt === null) readyAt = t;
      if (t - readyAt > 1.7 && !window.__ready) window.__ready = true;   // after the lamp has switched on
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return app;
}

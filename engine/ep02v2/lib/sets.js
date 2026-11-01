// EP02 v2 — detailed low-cost 3D locations: school corridor, bar, night street (+ a dark "void" with a light pool).
// Detail comes from procedural canvas textures (lockers, cinder block, brick, wood, asphalt, lit windows, signs),
// not from heavy geometry, so a 2-core CPU renderer stays fast. The fighters stand at x = ±0.9 facing along x.
import {THREE} from '../../ep02/lib/core.js';

// ---------------------------------------------------------------- helpers
const R = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
function ctex(w, h, draw, rx = 1, ry = 1, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function noise(g, w, h, a = .06, n = 4000) {
  for (let i = 0; i < n; i++) { const v = R() < .5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${a * R()})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
}
const std = (o = {}) => new THREE.MeshStandardMaterial({roughness: .7, metalness: 0, ...o});
const glow = (color, k = 1) => new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(k)});
function box(g, w, h, d, mat, x, y, z, cast = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m;
}
function plane(g, w, h, mat, x, y, z, ry = 0, rx = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; g.add(m); return m;
}
function cyl(g, rt, rb, h, mat, x, y, z, seg = 16, cast = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m;
}
function poolTex() {
  return ctex(256, 256, (g) => {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(190,210,255,.55)'); r.addColorStop(.45, 'rgba(150,180,240,.18)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  });
}
export function lightPool(g, r, x = 0, z = 0, op = 1, color = 0xffffff) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({map: poolTex(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending}));
  m.rotation.x = -Math.PI / 2; m.position.set(x, .006, z); g.add(m); return m;
}
function cone(g, x, y, z, h, r, op = .06, color = 0xbcd4ff) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 32, 1, true), new THREE.MeshBasicMaterial({color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide}));
  m.position.set(x, y - h / 2, z); g.add(m); return m;
}
// glowing sign text (neon) on a transparent plane
function sign(g, text, color, w, h, x, y, z, ry = 0, font = 'bold 110px Inter') {
  const t = ctex(512, 160, (c, W, H) => {
    c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = color; c.shadowBlur = 28; c.fillStyle = color; c.fillText(text, W / 2, H / 2);
    c.shadowBlur = 8; c.fillStyle = '#ffffff'; c.globalAlpha = .7; c.fillText(text, W / 2, H / 2);
  });
  return plane(g, w, h, new THREE.MeshBasicMaterial({map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}), x, y, z, ry);
}

export function makeVoid(scene) {
  const g = new THREE.Group(); scene.add(g);
  lightPool(g, 2.6); cone(g, 0, 7, 0, 7, 2.2, .035);
  return {g};
}

// ---------------------------------------------------------------- SCHOOL CORRIDOR (runs along -z)
export function makeSchool(scene) {
  const g = new THREE.Group(); scene.add(g);
  const L = 38, W = 4.2, Hc = 3.3, z0 = 11;
  // floor: speckled linoleum tiles, glossy
  const floorT = ctex(512, 512, (c, w, h) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = (i + j) % 2 ? 58 : 66; c.fillStyle = `rgb(${v - 8},${v},${v + 14})`; c.fillRect(i * 128, j * 128, 128, 128);
    }
    noise(c, w, h, .18, 9000); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 128, 0); c.lineTo(i * 128, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 128); c.lineTo(w, i * 128); c.stroke(); }
  }, W / 1.2, L / 1.2);
  plane(g, W, L, std({map: floorT, roughness: .22, metalness: .15}), 0, .001, z0 - L / 2, 0, -Math.PI / 2);
  // walls: painted cinder block
  const blockT = ctex(512, 256, (c, w, h) => {
    c.fillStyle = '#7d8aa3'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(40,50,70,.55)'; c.lineWidth = 4;
    for (let r = 0; r < 4; r++) {
      c.beginPath(); c.moveTo(0, r * 64); c.lineTo(w, r * 64); c.stroke();
      for (let k = 0; k < 5; k++) { const x = (k * 128 + (r % 2) * 64) % w; c.beginPath(); c.moveTo(x, r * 64); c.lineTo(x, r * 64 + 64); c.stroke(); }
    }
    noise(c, w, h, .08, 5000);
  }, L / 1.6, 2);
  for (const s of [-1, 1]) plane(g, L, Hc, std({map: blockT, roughness: .85}), s * W / 2, Hc / 2, z0 - L / 2, -s * Math.PI / 2);
  // lockers: one texture = one locker (door, vents, handle, number tag)
  const lockT = ctex(128, 512, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#2c4a86'); gr.addColorStop(.5, '#3a5c9e'); gr.addColorStop(1, '#2a4680');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#13213f'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#152648'; for (let i = 0; i < 5; i++) c.fillRect(30, 28 + i * 14, 68, 6);
    for (let i = 0; i < 5; i++) c.fillRect(30, 420 + i * 14, 68, 6);
    c.fillStyle = '#9fb0cc'; c.fillRect(92, 230, 10, 54); c.fillStyle = '#cfd8e8'; c.fillRect(40, 108, 34, 18);
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(10, 0, 8, h); noise(c, w, h, .06, 1500);
  });
  const nL = 46;
  lockT.repeat.set(nL, 1);
  const lockM = std({map: lockT, roughness: .45, metalness: .35});
  for (const s of [-1, 1]) {
    const len = nL * .42, lb = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.9, len), [lockM, lockM, std({color: 0x1e3260}), std({color: 0x1e3260}), lockM, lockM]);
    lb.position.set(s * (W / 2 - .25), .95, z0 - 1.5 - len / 2); lb.receiveShadow = true; g.add(lb);
    box(g, .52, .08, len, std({color: 0x24365c, metalness: .3, roughness: .5}), s * (W / 2 - .25), .04, z0 - 1.5 - len / 2);
  }
  // classroom doors with lit window + posters on the free wall bits
  const doorM = std({color: 0x5a3f2a, roughness: .55}), doorWin = glow(0xffe2b0, .75);
  for (const [s, z] of [[-1, 5.6], [1, 4.4], [-1, -9.2], [1, -15.5]]) {
    box(g, .1, 2.2, 1.0, doorM, s * (W / 2 - .05), 1.1, z); box(g, .11, .5, .32, doorWin, s * (W / 2 - .06), 1.6, z - .2);
  }
  const posterCols = ['#d8a63c', '#3f8f7a', '#c9d3e6', '#6a5bb0', '#d06b3a'];
  [[-1, 6.3], [1, 6.1], [-1, 3.6], [1, 3.4]].forEach(([s, z], i) => {
    const t = ctex(128, 180, (c, w, h) => { c.fillStyle = posterCols[i % 5]; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(12, 18, w - 24, 26); c.fillRect(12, 56, w - 50, 10); c.fillRect(12, 74, w - 34, 10); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(w / 2, 130, 26, 0, 7); c.fill(); });
    plane(g, .55, .78, std({map: t, roughness: .9}), s * (W / 2 - .01), 2.1, z, -s * Math.PI / 2);
  });
  // ceiling: acoustic tiles + fluorescent panels (one flickers, see flicker())
  const ceilT = ctex(256, 256, (c, w, h) => { c.fillStyle = '#596274'; c.fillRect(0, 0, w, h); noise(c, w, h, .2, 4000); c.strokeStyle = '#2c3240'; c.lineWidth = 6; c.strokeRect(0, 0, w, h); }, W / 1.2, L / 1.2);
  plane(g, W, L, std({map: ceilT, roughness: 1}), 0, Hc, z0 - L / 2, 0, Math.PI / 2);
  const panels = [];
  for (let i = 0; i < 9; i++) { const m = box(g, .6, .03, 1.2, glow(0xe8f0ff, 1.15), 0, Hc - .02, z0 - 1 - i * 3.6); panels.push(m); }
  // end of corridor: double doors + exit sign
  box(g, W, Hc, .2, std({color: 0x3c4a66}), 0, Hc / 2, z0 - L);
  box(g, 1.8, 2.3, .05, std({color: 0x6c7b96, metalness: .5, roughness: .3}), 0, 1.15, z0 - L + .12);
  sign(g, 'EXIT', '#3dff8a', .7, .22, 0, 2.6, z0 - L + .13);
  for (const z of [1.5, -6]) { const p = new THREE.PointLight(0xdfe8ff, 2.2, 7, 1.7); p.position.set(0, Hc - .3, z); g.add(p); }
  lightPool(g, 1.6, 0, 0, .35);
  return {g, panels, flicker(t) { const f = (Math.sin(t * 37) + Math.sin(t * 91)) > 1.3 ? .25 : 1; panels[3].material.color.setScalar(1.15 * f); }};
}

// ---------------------------------------------------------------- BAR (counter along x behind the fighters)
export function makeBar(scene) {
  const g = new THREE.Group(); scene.add(g);
  const woodT = (base, n, ry = 1) => ctex(512, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { const y = i * h / n; c.fillStyle = `rgba(0,0,0,${.15 + R() * .15})`; c.fillRect(0, y, w, 2);
      for (let k = 0; k < 14; k++) { c.strokeStyle = `rgba(${R() < .5 ? 0 : 255},${R() < .5 ? 0 : 200},0,.06)`; c.beginPath(); c.moveTo(0, y + R() * h / n); c.bezierCurveTo(w * .3, y + R() * h / n, w * .6, y + R() * h / n, w, y + R() * h / n); c.stroke(); } }
    noise(c, w, h, .05, 3000);
  }, 1, ry);
  const floorT = woodT('#3b2a22', 8); floorT.repeat.set(5, 10);
  plane(g, 16, 20, std({map: floorT, roughness: .9, metalness: 0}), 0, .001, 3, 0, -Math.PI / 2);
  // brick back wall
  const brickT = ctex(512, 512, (c, w, h) => {
    c.fillStyle = '#2a1d1c'; c.fillRect(0, 0, w, h);
    for (let r = 0; r < 16; r++) for (let k = 0; k < 9; k++) {
      const x = k * 64 - (r % 2) * 32, y = r * 32, v = 70 + R() * 40;
      c.fillStyle = `rgb(${v + 30},${v * .55},${v * .45})`; c.fillRect(x + 2, y + 2, 60, 28);
    }
    noise(c, w, h, .12, 8000);
  }, 4, 1.4);
  plane(g, 16, 4.2, std({map: brickT, roughness: .9}), 0, 2.1, -3.6);
  for (const s of [-1, 1]) plane(g, 20, 4.2, std({map: brickT, roughness: .9}), s * 6.5, 2.1, 3, s * Math.PI / 2);
  // back bar: dark mirror, lit shelves, bottles
  plane(g, 6.4, 1.5, std({color: 0x161a26, metalness: .9, roughness: .15}), 0, 2.0, -3.58);
  const shelfM = std({color: 0x2c2226, roughness: .4});
  for (const y of [1.5, 2.1, 2.7]) { box(g, 6.6, .05, .4, shelfM, 0, y, -3.38); box(g, 6.4, .015, .02, glow(0xffc070, .9), 0, y - .03, -3.2); }
  const btlCols = [0xa8641c, 0x3c7a3a, 0xcfd9e8, 0x7a2f1c, 0x2f5f8a, 0xd9b26a];
  const bodyG = new THREE.CylinderGeometry(.055, .06, .26, 10), neckG = new THREE.CylinderGeometry(.018, .025, .12, 8);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 26; i++) {
    const col = btlCols[(i * 7 + r * 3) % 6], m = std({color: col, emissive: col, emissiveIntensity: .35, roughness: .15, metalness: .1});
    const x = -3 + i * .235 + R() * .04, y = 1.53 + r * .6, sc = .85 + R() * .4;
    const b = new THREE.Mesh(bodyG, m); b.position.set(x, y + .13 * sc, -3.38); b.scale.setScalar(sc); g.add(b);
    const n = new THREE.Mesh(neckG, m); n.position.set(x, y + .32 * sc, -3.38); n.scale.setScalar(sc); g.add(n);
  }
  // counter
  const front = woodT('#4a2f22', 6); front.repeat.set(3, 1);
  box(g, 7.6, 1.05, .7, std({map: front, roughness: .5}), 0, .53, -1.85, true);
  box(g, 7.8, .07, .9, std({color: 0x2a1a14, roughness: .12, metalness: .3}), 0, 1.09, -1.85, true);
  box(g, 7.6, .06, .06, std({color: 0xb08a4a, metalness: .8, roughness: .25}), 0, .15, -1.47);   // brass foot rail
  for (let i = 0; i < 5; i++) { cyl(g, .02, .02, .32, std({color: 0xc9a25e, metalness: .9, roughness: .2}), -.9 + i * .18, 1.28, -2.0); }  // beer taps
  for (const [x, z] of [[-2.8, -1.7], [2.4, -1.75], [1.1, -1.8]]) cyl(g, .045, .035, .14, std({color: 0xe8c070, transparent: true, opacity: .75, roughness: .05, emissive: 0x9a6a20, emissiveIntensity: .3}), x, 1.19, z);
  // stools
  const seatM = std({color: 0x3a2a24, roughness: .35}), metal = std({color: 0x707a88, metalness: .8, roughness: .3});
  for (const x of [-3.2, -2.2, 2.2, 3.2]) {
    cyl(g, .23, .2, .09, seatM, x, .8, -1.1, 20, true); cyl(g, .025, .025, .78, metal, x, .39, -1.1, 8);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.17, .012, 6, 24), metal); ring.rotation.x = Math.PI / 2; ring.position.set(x, .3, -1.1); g.add(ring);
    cyl(g, .2, .22, .03, metal, x, .015, -1.1, 20);
  }
  // pendant lamps with shades + warm pools
  for (const x of [-2.4, 0, 2.4]) {
    const sh = new THREE.Mesh(new THREE.ConeGeometry(.24, .26, 24, 1, true), std({color: 0x1d2a24, side: THREE.DoubleSide, metalness: .4, roughness: .4}));
    sh.position.set(x, 2.55, -1.6); g.add(sh);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), glow(0xffd9a0, 1.4)); bulb.position.set(x, 2.45, -1.6); g.add(bulb);
    cyl(g, .006, .006, 1.4, std({color: 0x0a0a10}), x, 3.35, -1.6, 4);
    lightPool(g, .9, x, -1.4, .45, 0xffc890);
  }
  const warm = new THREE.PointLight(0xffb36b, 3.6, 8, 1.6); warm.position.set(0, 2.4, -1.4); g.add(warm);
  // neon + side tables (background)
  sign(g, 'OPEN', '#35d6ff', 1.3, .4, -4.6, 2.6, -3.55);
  sign(g, 'COLD BEER', '#ffb347', 1.8, .45, 4.3, 2.75, -3.55, 0, 'bold 90px Inter');
  for (const [x, z] of [[-4.6, .6], [4.8, .2]]) {
    cyl(g, .45, .45, .05, std({color: 0x2a1c16, roughness: .3}), x, .76, z, 24, true); cyl(g, .04, .04, .74, metal, x, .37, z, 8);
  }
  lightPool(g, 1.6, 0, 0, .35, 0xffd2a0);
  return {g, warm};
}

// ---------------------------------------------------------------- NIGHT STREET (road along x in front, sidewalk + buildings behind)
function facadeTex(seed, cols, rows, brick, lit) {
  let s = seed; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const W = 512, H = 1024;
  const base = ctex(W, H, (c) => {
    c.fillStyle = brick; c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 12) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, y, W, 2); for (let x = (y / 12 % 2) * 14; x < W; x += 28) c.fillRect(x, y, 2, 12); }
    noise(c, W, H, .1, 9000);
    const cw = W / cols, rh = (H - 160) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = i * cw + cw * .2, y = j * rh + rh * .18, w = cw * .6, h = rh * .62;
      c.fillStyle = '#1a1d26'; c.fillRect(x - 4, y - 4, w + 8, h + 8);
      c.fillStyle = '#0b0e16'; c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(160,180,220,.12)'; c.fillRect(x, y, w * .5, h);
    }
    // storefront band
    c.fillStyle = '#121620'; c.fillRect(0, H - 160, W, 160);
  });
  const em = ctex(W, H, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const cw = W / cols, rh = (H - 160) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (r() > lit) continue;
      const x = i * cw + cw * .2, y = j * rh + rh * .18, w = cw * .6, h = rh * .62;
      const warm = r() < .7, gr = c.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, warm ? '#ffcf8a' : '#9cc4ff'); gr.addColorStop(1, warm ? '#c07a3a' : '#4a6aa8');
      c.fillStyle = gr; c.fillRect(x, y, w, h);
      if (r() < .5) { c.fillStyle = 'rgba(0,0,0,.6)'; for (let k = 0; k < 6; k++) c.fillRect(x, y + k * h / 6, w, h / 14); }   // blinds
      if (r() < .3) { c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(x + w * .3, y + h * .35, w * .18, h * .65); }               // silhouette
    }
  }, 1, 1);
  return {base, em};
}
export function makeStreet(scene) {
  const g = new THREE.Group(); scene.add(g);
  // wet asphalt
  const asphalt = ctex(512, 512, (c, w, h) => {
    c.fillStyle = '#1b2030'; c.fillRect(0, 0, w, h); noise(c, w, h, .22, 26000);
    for (let i = 0; i < 9; i++) { const gr = c.createRadialGradient(R() * w, R() * h, 0, R() * w, R() * h, 40 + R() * 70); gr.addColorStop(0, 'rgba(5,8,14,.25)'); gr.addColorStop(1, 'rgba(5,8,14,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }
  }, 10, 5);
  const roughT = ctex(256, 256, (c, w, h) => { c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { c.fillStyle = '#4a4a4a'; c.beginPath(); c.ellipse(R() * w, R() * h, 10 + R() * 22, 5 + R() * 10, R() * 3, 0, 7); c.fill(); } }, 10, 5, false);
  plane(g, 60, 26, std({map: asphalt, roughnessMap: roughT, roughness: .9, metalness: .35}), 0, .001, 6.5, 0, -Math.PI / 2);
  const lineM = glow(0xb9c2d6, .38);
  for (let i = 0; i < 16; i++) plane(g, 1.4, .12, lineM, -20 + i * 2.7, .004, 4.2, 0, -Math.PI / 2);
  for (let i = 0; i < 7; i++) plane(g, .38, 2.4, lineM, 4.6 + i * .7, .004, 1.6, 0, -Math.PI / 2);   // crosswalk
  // sidewalk slabs + curb
  const slab = ctex(256, 256, (c, w, h) => { c.fillStyle = '#4a5160'; c.fillRect(0, 0, w, h); noise(c, w, h, .2, 7000); c.strokeStyle = 'rgba(10,12,18,.7)'; c.lineWidth = 4; c.strokeRect(0, 0, w, h); }, 30, 2.5);
  const walk = box(g, 60, .14, 5, std({map: slab, roughness: .8}), 0, .07, -3.9); walk.receiveShadow = true;
  box(g, 60, .16, .18, std({color: 0x6a7282, roughness: .7}), 0, .08, -1.35);
  // building row
  const bricks = ['#5a3a30', '#3d3a44', '#4f4036', '#2f3a4a', '#5c4636', '#3a3236'];
  const B = [[-13, 8, 4.4, 4, 5], [-8.4, 11, 4.6, 4, 7], [-3.6, 9, 5.0, 5, 6], [1.4, 12, 4.8, 4, 8], [6.2, 8.5, 4.6, 4, 5], [11, 10, 4.8, 4, 6], [15.6, 7, 4.2, 3, 4]];
  B.forEach(([x, h, w, cols, rows], i) => {
    const f = facadeTex(100 + i * 17, cols, rows, bricks[i % 6], .35);
    const m = std({map: f.base, emissiveMap: f.em, emissive: 0xffffff, emissiveIntensity: .5, roughness: .9});
    const side = std({color: 0x161b28, roughness: .9});
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), [side, side, side, side, m, side]); b.position.set(x, h / 2, -7.9); b.receiveShadow = true; g.add(b);
    box(g, w + .2, .25, 3.2, std({color: 0x10141e}), x, h + .12, -7.9);   // cornice
  });
  // storefronts: deli (glowing window + sign), closed shop with shutter
  box(g, 3.0, 1.9, .1, glow(0xffd9a6, .55), -3.4, 1.3, -6.37);
  sign(g, '24/7 DELI', '#ffb347', 2.6, .6, -3.4, 2.75, -6.3, 0, 'bold 92px Inter');
  const shutter = ctex(256, 256, (c, w, h) => { c.fillStyle = '#5b6170'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 10) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y, w, 3); } noise(c, w, h, .15, 3000); });
  plane(g, 3.2, 2.4, std({map: shutter, metalness: .4, roughness: .5}), 6.2, 1.2, -6.37);
  sign(g, 'PHARMACY', '#4fe0c0', 2.4, .5, 1.4, 2.8, -6.3, 0, 'bold 80px Inter');
  box(g, 2.6, 1.8, .1, glow(0x9fe8d8, .25), 1.4, 1.25, -6.37);
  // street furniture: lamp, hydrant, trash can, parked car, background silhouettes
  const pole = std({color: 0x2a3550, metalness: .6, roughness: .35});
  const px = 1.15, pz = -1.7;
  cyl(g, .06, .08, 4.3, pole, px, 2.15, pz, 10, true);
  box(g, 1.1, .07, .07, pole, px - .5, 4.2, pz);
  box(g, .44, .1, .24, std({color: 0x1a2030, metalness: .5}), px - .95, 4.16, pz);
  box(g, .36, .02, .18, glow(0xeaf2ff, 1.4), px - .95, 4.1, pz);
  const sp = new THREE.SpotLight(0xd8e6ff, 45, 12, .62, .55, 1.6); sp.position.set(px - .95, 4.05, pz); sp.target.position.set(-.1, 0, 0);
  sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -.0008; g.add(sp); g.add(sp.target);
  const cn = cone(g, px - .95, 4.05, pz, 4.0, 1.7, .045); cn.rotation.z = -.12;
  lightPool(g, 2.1, -.2, -.2, .7);
  const red2 = std({color: 0x8a6a2a, roughness: .5, metalness: .3});        // hydrant (ochre — red is reserved)
  cyl(g, .12, .14, .55, red2, 3.2, .42, -1.7, 12); cyl(g, .15, .15, .06, red2, 3.2, .7, -1.7, 12);
  cyl(g, .26, .22, .9, std({color: 0x2c3a3a, metalness: .4, roughness: .5}), -2.6, .59, -2.0, 16, true);
  // parked car (low-poly sedan) on the road, left
  const car = new THREE.Group(); car.position.set(-5.6, 0, 1.0); g.add(car);
  const paint = std({color: 0x26324a, metalness: .7, roughness: .25}), glass = std({color: 0x0a0e18, metalness: .9, roughness: .05});
  box(car, 4.2, .62, 1.8, paint, 0, .62, 0, true); box(car, 2.3, .5, 1.6, glass, -.2, 1.15, 0, true);
  box(car, 2.25, .06, 1.62, paint, -.2, 1.42, 0);
  for (const [x, z] of [[-1.35, .9], [1.35, .9], [-1.35, -.9], [1.35, -.9]]) { const w = cyl(car, .34, .34, .24, std({color: 0x0b0d12, roughness: .8}), x, .34, z, 16); w.rotation.x = Math.PI / 2; }
  box(car, .05, .14, .4, glow(0x5a1018, .9), -2.12, .78, .6); box(car, .05, .14, .4, glow(0x5a1018, .9), -2.12, .78, -.6);   // dim tail lights
  const heads = [box(car, .05, .14, .42, glow(0xf2f6ff, 1.5), 2.12, .74, .6), box(car, .05, .14, .42, glow(0xf2f6ff, 1.5), 2.12, .74, -.6)];
  const beam = new THREE.SpotLight(0xe8f0ff, 0, 18, .45, .5, 1.2); beam.position.set(2.2, .8, 0); beam.target.position.set(9, 0, 0); car.add(beam); car.add(beam.target);
  // far skyline
  for (let i = 0; i < 12; i++) { const h = 10 + R() * 14; box(g, 4 + R() * 3, h, 3, std({color: 0x0f1626, roughness: 1}), -24 + i * 4.4, h / 2, -18 - R() * 4); }
  return {g, sp, car, beam, heads};
}

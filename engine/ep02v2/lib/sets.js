// EP02 v2 — three low-poly locations for the hook (school corridor, bar, night street) + a dark "void" with a light pool.
// The two fighters stand at x = ±0.62 facing each other along x; every set is built around the origin.
import {THREE} from '../../ep02/lib/core.js';

const box = (g, w, h, d, mat, x, y, z, shadow = false) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m;
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: .7, metalness: 0, ...o});
const glow = (color, k = 1) => new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(k), fog: true});

function poolTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(190,210,255,.55)'); r.addColorStop(.45, 'rgba(150,180,240,.18)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}
export function lightPool(g, r, x = 0, z = 0, op = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({map: poolTex(), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending}));
  m.rotation.x = -Math.PI / 2; m.position.set(x, .004, z); g.add(m); return m;
}
function cone(g, x, y, z, h, r, op = .07) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 32, 1, true), new THREE.MeshBasicMaterial({color: 0xbcd4ff, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide}));
  m.position.set(x, y - h / 2, z); g.add(m); return m;
}

export function makeVoid(scene) {
  const g = new THREE.Group(); scene.add(g);
  lightPool(g, 2.6);
  cone(g, 0, 7, 0, 7, 2.2, .035);
  return {g};
}

export function makeSchool(scene) {
  const g = new THREE.Group(); scene.add(g);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 40), std(0x141d33, {roughness: .32, metalness: .1}));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, .001, -10); floor.receiveShadow = true; g.add(floor);
  const lk = std(0x3a4f7d, {roughness: .5, metalness: .2}), lkD = std(0x1a2644, {roughness: .6});
  for (const side of [-1, 1]) {
    box(g, .2, 3.6, 40, lkD, side * 2.75, 1.8, -10);                       // wall
    for (let i = 0; i < 44; i++) {
      const z = 6 - i * .62;
      box(g, .42, 1.95, .58, lk, side * 2.4, .98, z);                       // locker
      box(g, .02, .5, .3, lkD, side * 2.18, 1.55, z);                         // vent slot
    }
  }
  for (let i = 0; i < 8; i++) box(g, .32, .05, 1.8, glow(0xdfe9ff, 1.1), 0, 3.4, 4 - i * 4.2);  // ceiling strips
  box(g, 5.6, .1, 40, std(0x0f1628), 0, 3.48, -10);
  lightPool(g, 1.8, 0, 0, .6);
  return {g};
}

export function makeBar(scene) {
  const g = new THREE.Group(); scene.add(g);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), std(0x17182a, {roughness: .5}));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, .001, -2); floor.receiveShadow = true; g.add(floor);
  const wood = std(0x2b2236, {roughness: .45}), top = std(0x3a3150, {roughness: .25, metalness: .2});
  box(g, 7.5, 1.05, .7, wood, 0, .53, -1.75, true); box(g, 7.7, .07, .85, top, 0, 1.08, -1.75, true);
  box(g, 8, 3.6, .2, std(0x151628), 0, 1.8, -3.3);                         // back wall
  for (const y of [1.55, 2.15]) box(g, 6, .05, .35, top, 0, y, -3.05);    // shelves
  const amber = glow(0xffb45e, .55), cyan = glow(0x7fd4ff, .55), clear = glow(0xd8e4ff, .35);
  const btl = new THREE.CylinderGeometry(.06, .07, .34, 10);
  for (let i = 0; i < 26; i++) {
    const y = i < 13 ? 1.75 : 2.35, x = -2.7 + (i % 13) * .45 + (i > 12 ? .2 : 0);
    const m = new THREE.Mesh(btl, [amber, cyan, clear][(i * 7) % 3]); m.position.set(x, y, -3.0); g.add(m);
  }
  for (let i = 0; i < 4; i++) {                                              // stools
    const x = -2.4 + i * 1.6; if (Math.abs(x) < .9) continue;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .06, 16), top); s.position.set(x, .78, -1.05); s.castShadow = true; g.add(s);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .78, 8), top); p.position.set(x, .39, -1.05); g.add(p);
  }
  for (const x of [-2.2, 0, 2.2]) {                                          // pendant lamps
    const l = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 10), glow(0xffd9a0, 1.2)); l.position.set(x, 2.55, -1.5); g.add(l);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1.2, 4), std(0x0a0a12)); w.position.set(x, 3.2, -1.5); g.add(w);
  }
  const warm = new THREE.PointLight(0xffb36b, 3.2, 7, 1.6); warm.position.set(0, 2.4, -1.2); g.add(warm);
  lightPool(g, 1.7, 0, 0, .5);
  return {g, warm};
}

export function makeStreet(scene) {
  const g = new THREE.Group(); scene.add(g);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), std(0x0d1426, {roughness: .38, metalness: .15}));
  road.rotation.x = -Math.PI / 2; road.position.set(0, .001, 4); road.receiveShadow = true; g.add(road);
  const curb = std(0x1c2640, {roughness: .8});
  box(g, 60, .14, 4, curb, 0, .07, -3.2);                                  // sidewalk
  const dash = glow(0x9aa8c4, .45);
  for (let i = 0; i < 14; i++) box(g, 1.3, .006, .12, dash, -16 + i * 2.6, .004, 2.6);
  const bld = std(0x111a30, {roughness: .9}), win = glow(0xffc98a, .5), winC = glow(0x9cc4ff, .4);
  const H = [7, 11, 6, 9, 13, 8, 10, 6.5];
  H.forEach((h, i) => {
    const x = -12 + i * 3.4, z = -7.5 - (i % 3) * 1.2;
    box(g, 3.1, h, 2.6, bld, x, h / 2, z);
    for (let k = 0; k < 7; k++) {
      if (((i * 13 + k * 7) % 5) > 1) continue;
      const wy = 1.4 + ((k * 3 + i) % Math.max(2, Math.floor(h / 1.4))) * 1.3, wx = x - 1 + (k % 3) * .9;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.45, .6), (k + i) % 3 ? win : winC); m.position.set(wx, Math.min(h - .8, wy), z + 1.31); g.add(m);
    }
  });
  // street lamp: pole, head, light cone, real spot light with shadows
  const pole = std(0x2a3550, {metalness: .5, roughness: .4});
  const px = 1.15, pz = -1.7;
  box(g, .1, 4.2, .1, pole, px, 2.1, pz);
  box(g, 1.1, .08, .08, pole, px - .5, 4.15, pz);
  const head = box(g, .42, .1, .22, glow(0xeaf2ff, 1.4), px - .95, 4.08, pz);
  const sp = new THREE.SpotLight(0xd8e6ff, 40, 12, .62, .55, 1.6); sp.position.set(px - .95, 4.05, pz); sp.target.position.set(-.1, 0, 0);
  sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -.0008; g.add(sp); g.add(sp.target);
  const cn = cone(g, px - .95, 4.05, pz, 4.0, 1.7, .05); cn.rotation.z = -.12;
  lightPool(g, 2.0, -.2, -.2, .75);
  return {g, sp, head};
}

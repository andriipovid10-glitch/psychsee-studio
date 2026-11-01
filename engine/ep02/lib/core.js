// PsychSee EP02 — shared engine: math, timing/cues, renderer + post, stickman rig, HUD.
// Everything is a pure function of time t (seconds of the current scene).
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
export {THREE};

export const W = 1920, H = 1080, FPS = 30;
export const RED = '#ff3340', RED_D = '#e3262d', GREY = '#8a97b3', NAVY = 0x0b1222;
// ---------------------------------------------------------------- math
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const eo = t => 1 - Math.pow(1 - t, 4);
export const ei = t => t * t * t;
export const back = t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const vlerp = (a, b, k) => a.clone().lerp(b, k);
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- timing (cues come from the VO)
export const ORDER = ['s00', 's01'];
export async function loadTiming(scene) {
  const all = {};
  for (const s of ORDER) {
    try { all[s] = await (await fetch(`timing_${s}.json?x=${Date.now()}`)).json(); } catch (e) { if (s === scene) throw e; }
  }
  const cfg = await (await fetch(`cues.json?x=${Date.now()}`)).json();
  let offset = 0;
  for (const s of ORDER) { if (s === scene) break; if (all[s]) offset += all[s].duration; }
  const T = all[scene];
  const cue = (name, dt = 0) => { if (!(name in T.cues)) throw new Error('missing cue ' + name); return T.cues[name] + dt; };
  return {T, cue, offset, duration: T.duration, story: (cfg[scene] || {}).story, words: T.words};
}

// ---------------------------------------------------------------- renderer, lights, post
export function setupStage(canvas) {
  const R = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  R.setSize(W, H, false); R.setPixelRatio(1);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NAVY);
  scene.fog = new THREE.Fog(NAVY, 12, 26);
  const cam = new THREE.PerspectiveCamera(34, W / H, 0.02, 100);
  const hemi = new THREE.HemisphereLight(0x8fa6d6, NAVY, .55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-4, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6;
  Object.assign(key.shadow.camera, {left: -6, right: 6, top: 6, bottom: -6}); key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb2ff, 3.2); rim.position.set(5, 4, -6); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({opacity: .55}));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const composer = new EffectComposer(R);
  composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .55, .5, .92); composer.addPass(bloom);
  const grade = new ShaderPass(GRADE); composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {R, scene, cam, composer, bloom, grade: grade.uniforms, key, rim, hemi, ground};
}

// colour grade: selective desaturation (keeps red), vignette, grain, chromatic split, flash
const GRADE = {
  uniforms: {tDiffuse: {value: null}, desat: {value: 0}, vign: {value: .35}, tunnel: {value: 0}, grain: {value: .014},
    seed: {value: 0}, ca: {value: 0}, flash: {value: 0}, black: {value: 0}, res: {value: new THREE.Vector2(W, H)}},
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform float desat,vign,tunnel,grain,seed,ca,flash,black;uniform vec2 res;varying vec2 vUv;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*43758.5453);}
  void main(){vec2 d=vUv-.5;vec2 o=d*ca/res.x*2.;
    vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
    float redness=clamp((c.r-max(c.g,c.b))*2.5,0.,1.);
    float l=dot(c,vec3(.299,.587,.114));c=mix(c,mix(vec3(l)*vec3(.92,.97,1.08),c,redness),desat);
    float r=length(d*vec2(1.,.62));c*=1.-vign*smoothstep(.25,.85,r);
    c*=1.-tunnel*smoothstep(.32-tunnel*.12,.62-tunnel*.2,r);
    c+=(h(vUv*res)-.5)*grain;c=mix(c,vec3(1.),flash);c*=1.-black;gl_FragColor=vec4(c,1.);}`
};

// ---------------------------------------------------------------- stickman rig
const cyl = new THREE.CylinderGeometry(1, 1, 1, 24), sph = new THREE.SphereGeometry(1, 48, 32);
const UP = new THREE.Vector3(0, 1, 0);
export function makeMan(scene, color = 0xe6ebf5) {
  const mat = new THREE.MeshStandardMaterial({color, roughness: .42, metalness: 0, transparent: true});
  const g = new THREE.Group(); scene.add(g);
  const head = new THREE.Mesh(sph, mat); head.scale.setScalar(.34); head.castShadow = true; g.add(head);
  const headG = new THREE.Group(); g.add(headG);          // follows the head: brain / eyes live here
  const limbs = [], joints = [];
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(cyl, mat); m.castShadow = true; g.add(m); limbs.push(m); }
  for (let i = 0; i < 11; i++) { const m = new THREE.Mesh(sph, mat); m.castShadow = true; g.add(m); joints.push(m); }
  // red nerve cores inside limbs ("the body is driving")
  const nerveMat = new THREE.MeshBasicMaterial({color: 0xff2a30, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending});
  const nerves = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(cyl, nerveMat); m.visible = false; g.add(m); nerves.push(m); }
  return {g, mat, head, headG, limbs, joints, nerves, nerveMat, P: {}};
}
function bone(m, a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a); const L = d.length();
  m.position.copy(a).addScaledVector(d, .5); m.scale.set(r, L, r); m.quaternion.setFromUnitVectors(UP, d.normalize());
}
const nz = v => v.clone().normalize();
// o: {root:[x,y,z], bob, lean (fwd +), roll, headLean, ua:{L,R}, la:{L,R}, th:{L,R}, sh:{L,R}} directions in man-local (faces +z, his left = +x)
export function pose(M, o = {}) {
  const r0 = o.root || [0, 0, 0], b = o.bob || 0;
  const lean = o.lean || 0, roll = o.roll || 0;
  const hip = V3(r0[0], 1.04 + b + r0[1], r0[2]);
  const d = V3(Math.sin(roll), Math.cos(lean) * Math.cos(roll), Math.sin(lean) * Math.cos(roll)).normalize();
  const sh = hip.clone().addScaledVector(d, .8), neck = hip.clone().addScaledVector(d, .95);
  const hl = (o.headLean || 0) + lean;
  const hd = V3(Math.sin(roll * 1.2), Math.cos(hl), Math.sin(hl)).normalize();
  const head = neck.clone().addScaledVector(hd, .38);
  const def = {ua: {L: V3(.25, -.97, 0), R: V3(-.25, -.97, 0)}, la: {L: V3(.1, -.99, .05), R: V3(-.1, -.99, .05)},
    th: {L: V3(.13, -.99, 0), R: V3(-.13, -.99, 0)}, sh: {L: V3(.02, -1, 0), R: V3(-.02, -1, 0)}};
  const g = (k, s) => nz((o[k] && o[k][s]) || def[k][s]);
  const eL = sh.clone().addScaledVector(g('ua', 'L'), .62), hL = eL.clone().addScaledVector(g('la', 'L'), .58);
  const eR = sh.clone().addScaledVector(g('ua', 'R'), .62), hR = eR.clone().addScaledVector(g('la', 'R'), .58);
  const kL = hip.clone().addScaledVector(g('th', 'L'), .53), fL = kL.clone().addScaledVector(g('sh', 'L'), .52);
  const kR = hip.clone().addScaledVector(g('th', 'R'), .53), fR = kR.clone().addScaledVector(g('sh', 'R'), .52);
  const r = .075;
  M.head.position.copy(head); M.headG.position.copy(head);
  M.headG.quaternion.setFromUnitVectors(UP, hd);
  const B = [[hip, neck, r], [sh, eL, r], [eL, hL, r], [sh, eR, r], [eR, hR, r], [hip, kL, r], [kL, fL, r], [hip, kR, r], [kR, fR, r], [neck, head, r * .9]];
  B.forEach(([a, c, rr], i) => { bone(M.limbs[i], a, c, rr); bone(M.nerves[i], a, c, rr * .38); });
  [hip, neck, eL, hL, eR, hR, kL, fL, kR, fR, sh].forEach((p, i) => { M.joints[i].position.copy(p); M.joints[i].scale.setScalar(r * 1.05); });
  M.P = {hip, neck, sh, head, eL, hL, eR, hR, kL, fL, kR, fR};
  if (M.after) M.after(M);
}
export function setXray(M, k, nerve = 0) {
  M.mat.opacity = 1 - .84 * k; M.mat.depthWrite = k < .2;
  M.nerveMat.opacity = nerve; M.nerves.forEach(n => n.visible = nerve > .002);
}
export const world = (M, p) => M.g.localToWorld(p.clone());

// heart / ribs / veins / red light (from reference-ep00), parented to a man
export function makeChest(M) {
  const inside = new THREE.Group(); M.g.add(inside);
  const hs = new THREE.Shape(); const s = .11;
  hs.moveTo(0, -s * .9); hs.bezierCurveTo(-s * 1.4, -s * .1, -s * 1.0, s * .95, 0, s * .38); hs.bezierCurveTo(s * 1.0, s * .95, s * 1.4, -s * .1, 0, -s * .9);
  const hgeo = new THREE.ExtrudeGeometry(hs, {depth: .08, bevelEnabled: true, bevelThickness: .05, bevelSize: .04, bevelSegments: 8, curveSegments: 32}); hgeo.center();
  const heartMat = new THREE.MeshStandardMaterial({color: 0xc8101a, emissive: 0xff0d18, emissiveIntensity: 0, roughness: .3});
  const heart = new THREE.Mesh(hgeo, heartMat); heart.position.set(.05, .08, .02); heart.rotation.y = Math.PI; inside.add(heart);
  const ribMat = new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .06, transparent: true, opacity: 0, roughness: .5});
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(.26 - i * .012, .016, 10, 48, Math.PI * 1.55), ribMat);
    m.rotation.x = Math.PI / 2; m.rotation.z = Math.PI * .5 + Math.PI * .225; m.position.y = .28 - i * .12; m.scale.set(1, .8, 1); inside.add(m);
  }
  const redL = new THREE.PointLight(0xff2a2a, 0, 4, 1.6); inside.add(redL);
  return {inside, heart, heartMat, ribMat, redL};
}
export const pulse = ph => { const f = ph - Math.floor(ph); return Math.exp(-Math.pow((f - .02) / .05, 2)) + .6 * Math.exp(-Math.pow((f - .22) / .05, 2)); };

// ---------------------------------------------------------------- camera helpers
// orbit around centre c: az 0 = from +z, positive az towards +x; el = elevation (rad)
export function orbitPos(c, r, az, el) { return V3(c.x + Math.sin(az) * Math.cos(el) * r, c.y + Math.sin(el) * r, c.z + Math.cos(az) * Math.cos(el) * r); }
export function shake(t, amt) { return V3(Math.sin(t * 61.3) * amt + Math.sin(t * 23.1) * amt * .6, Math.cos(t * 47.7) * amt, Math.sin(t * 37.9) * amt * .5); }

// ---------------------------------------------------------------- DOM helpers
export const $ = id => document.getElementById(id);
export function words(el, text) {
  el.innerHTML = ''; return text.split(' ').map(w => { const s = document.createElement('span'); s.textContent = w; el.appendChild(s); el.appendChild(document.createTextNode(' ')); return s; });
}
// slide up from blur with back-ease overshoot (house style)
export function kin(span, t, t0, dur = .4, dy = 110) {
  const k = back(seg(t, t0, t0 + dur)); const kb = clamp(seg(t, t0, t0 + dur * .7));
  span.style.transform = `translateY(${(1 - k) * dy}px)`; span.style.opacity = clamp(seg(t, t0, t0 + dur * .5));
  span.style.filter = `blur(${(1 - kb) * 14}px)`;
}
export function show(el, o) { el.style.opacity = o; el.style.visibility = o > .001 ? 'visible' : 'hidden'; }
export function project(cam, p) { const v = p.clone().project(cam); return [(v.x * .5 + .5) * W, (-v.y * .5 + .5) * H, v.z < 1]; }

// running timecode (top-right) and story clock T+ (reusable for the whole episode)
export function timecode(el, globalT) {
  const fr = Math.floor(globalT * FPS); const s = Math.floor(fr / FPS);
  el.textContent = `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(fr % FPS).padStart(2, '0')}`;
}

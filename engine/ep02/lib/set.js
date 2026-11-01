// The fight set shared by scene00 and scene01: aggressor A shoves victim B; time freezes mid-stagger.
import {THREE, V3, makeMan, pose, makeChest, ease, seg, lerp, clamp, back} from './core.js';
import {makeBrain} from './brain.js';

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
export const GLOW = () => glowTex();

export function makeSet(stage) {
  const {scene} = stage;
  const A = makeMan(scene), B = makeMan(scene);
  A.g.position.set(-.92, 0, 0); A.g.rotation.y = Math.PI / 2;
  B.g.position.set(.92, 0, 0); B.g.rotation.y = -Math.PI / 2;
  const chest = makeChest(B);
  const brain = makeBrain(B.headG);
  // 7 "decision" nodes inside B
  const tex = glowTex(); const nodes = [];
  const cols = [0xff3340, 0xdfeaff, 0xdfeaff, 0xff3340, 0xdfeaff, 0xdfeaff, 0xdfeaff];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, color: cols[i], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false}));
    s.scale.setScalar(.22); B.g.add(s); nodes.push(s);
  }
  return {A, B, chest, brain, nodes, tex};
}

// choreography. tf = character time (frozen after the freeze point)
export function poseSet(S, tf, c) {
  const {A, B} = S;
  const sh = c.shove;                         // contact
  const idle = Math.sin(tf * 2.3);
  // A: menace -> wind-up -> two-hand shove
  const wind = ease(seg(tf, sh - .55, sh - .14)), thrust = back(seg(tf, sh - .14, sh + .08));
  const fwd = thrust;
  const mix = (a, b, k) => a.clone().lerp(b, k);
  const uaRest = {L: V3(.34, -.92, .12), R: V3(-.34, -.92, .12)}, laRest = {L: V3(.1, -.6, .8), R: V3(-.1, -.6, .8)};
  const uaWind = {L: V3(.45, -.65, -.55), R: V3(-.45, -.65, -.55)}, laWind = {L: V3(.05, .25, 1), R: V3(-.05, .25, 1)};
  const uaPush = {L: V3(.2, .02, 1), R: V3(-.2, .02, 1)}, laPush = {L: V3(.05, .08, 1), R: V3(-.05, .08, 1)};
  const ua = {}, la = {};
  for (const s of ['L', 'R']) { ua[s] = mix(mix(uaRest[s], uaWind[s], wind), uaPush[s], fwd); la[s] = mix(mix(laRest[s], laWind[s], wind), laPush[s], fwd); }
  pose(A, {root: [0, 0, .28 * fwd - .06 * wind], bob: idle * .012, lean: .1 - .08 * wind + .3 * fwd, headLean: .05,
    ua, la, th: {L: V3(.13, -.99, .1 + .35 * fwd), R: V3(-.13, -.97, -.2 - .25 * fwd)}, sh: {L: V3(.02, -1, -.05), R: V3(-.02, -1, .05)}});
  // B: guarded -> hit -> stagger back (arms flail, one foot leaves the floor)
  const hit = ease(seg(tf, sh - .02, sh + .42)), whip = back(seg(tf, sh - .02, sh + .2));
  const bua0 = {L: V3(.3, -.95, .08), R: V3(-.3, -.95, .08)}, bla0 = {L: V3(.12, -.85, .5), R: V3(-.12, -.85, .5)};
  const bua1 = {L: V3(.55, .35, .75), R: V3(-.7, .05, .7)}, bla1 = {L: V3(.35, .75, .55), R: V3(-.45, .55, .7)};
  const bua = {}, bla = {};
  for (const s of ['L', 'R']) { bua[s] = mix(bua0[s], bua1[s], hit); bla[s] = mix(bla0[s], bla1[s], hit); }
  pose(B, {root: [0, .05 * hit, -.42 * hit], bob: idle * .012 * (1 - hit), lean: -.04 - .36 * hit, roll: .06 * hit, headLean: .32 * whip - .1 * hit,
    ua: bua, la: bla, th: {L: V3(.13, -.88 + .2 * hit, .05 + .5 * hit), R: V3(-.16, -.98, -.12 * hit)}, sh: {L: V3(.02, -1, -.25 * hit), R: V3(-.02, -1, .05)}});
}

// place the 7 decision nodes on B's body (local coords from the pose)
export function placeNodes(S) {
  const P = S.B.P; const n = S.nodes;
  const h = P.head, mid = (a, b, k) => a.clone().lerp(b, k);
  n[0].position.copy(h).add(V3(0, .05, 0));                 // brain
  n[1].position.copy(h).add(V3(0, -.12, .26));             // eyes
  n[2].position.copy(h).add(V3(.3, -.04, 0));              // ears
  n[3].position.copy(mid(P.hip, P.sh, .78)).add(V3(.04, 0, .05)); // heart
  n[4].position.copy(mid(P.hip, P.sh, .82)).add(V3(-.14, 0, 0));  // lungs
  n[5].position.copy(mid(P.hip, P.sh, .35)).add(V3(.1, 0, -.05)); // adrenals
  n[6].position.copy(mid(P.hip, P.kL, .55));               // muscles
}

// EP02 v2 — stickman personality: a simple face (eyes + pupils, brows, nose, mouth) and simple clothes
// (shirt/hoodie, sleeves, pants, shoes, hair or cap). Hooked into the rig via M.after (called at the end of pose()).
// Expression knobs, set any time before pose(): M.face = {pupil: 1 (1 = normal, 1.8 = dilated), mouth: 0..1 (open), brow: -1..1 (angry..surprised)}
import {THREE} from '../../ep02/lib/core.js';

export const LOOKS = {
  you:    {shirt: 0x2f5fb3, pants: 0x1d2433, shoes: 0xf2f2f2, hair: 0x2a1d16, hood: true},
  thug:   {shirt: 0x17181c, pants: 0x2b2f3a, shoes: 0x0e0e10, hair: 0x101114, cap: 0x101114},
  second: {shirt: 0xb3262e, pants: 0x1f2230, shoes: 0x111111, hair: 0x120d0a},
  c1: {shirt: 0x4b5d4a, pants: 0x2a2e36, shoes: 0x6b5a48, hair: 0x3a2a1c},
  c2: {shirt: 0x6b5a7a, pants: 0x30303a, shoes: 0x1a1a1a, hair: 0x111111, cap: 0x2d3b55},
  c3: {shirt: 0x8a7a5a, pants: 0x3a3428, shoes: 0x222222, hair: 0x5a3a20},
  c4: {shirt: 0x3d4f66, pants: 0x1f1f24, shoes: 0xcccccc, hair: 0x1c140e},
  c5: {shirt: 0x7a4a3a, pants: 0x262a33, shoes: 0x333333, hair: 0x0e0e0e},
};
const cyl = new THREE.CylinderGeometry(1, 1, 1, 18), sph = new THREE.SphereGeometry(1, 28, 18);
const UP = new THREE.Vector3(0, 1, 0);
function bone(m, a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  m.position.copy(a).addScaledVector(d, .5); m.scale.set(r, L, r); m.quaternion.setFromUnitVectors(UP, d.normalize());
}
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: .75, metalness: 0, transparent: true, ...o});

export function dress(M, lookName = 'c1') {
  const L = LOOKS[lookName] || LOOKS.c1;
  const shirt = mat(L.shirt), pants = mat(L.pants), shoes = mat(L.shoes, {roughness: .5}), hair = mat(L.hair, {roughness: .9});
  const eyeW = mat(0xf7f7f2, {roughness: .3}), dark = mat(0x0b0b0e, {roughness: .3}), lip = mat(0x5a2a2e, {roughness: .6}), nose = mat(0xd9dee8, {roughness: .5});
  const mats = [shirt, pants, shoes, hair, eyeW, dark, lip, nose];
  const add = (geo, m, parent = M.g, shadow = true) => { const x = new THREE.Mesh(geo, m); x.castShadow = shadow; parent.add(x); return x; };
  const C = {
    torso: add(cyl, shirt), sleeveL: add(cyl, shirt), sleeveR: add(cyl, shirt), collar: add(sph, shirt),
    thighL: add(cyl, pants), thighR: add(cyl, pants), shinL: add(cyl, pants), shinR: add(cyl, pants), hipBall: add(sph, pants),
    shoeL: add(new THREE.BoxGeometry(1, 1, 1), shoes), shoeR: add(new THREE.BoxGeometry(1, 1, 1), shoes),
  };
  // face lives on the head group (follows head position + tilt); local +z = where he looks
  const F = new THREE.Group(); M.headG.add(F);
  const eye = s => { const g = new THREE.Group(); F.add(g); g.position.set(.115 * s, .06, .275);
    const w = add(sph, eyeW, g, false); w.scale.set(.085, .095, .05);
    const p = add(sph, dark, g, false); p.position.z = .04; p.scale.set(.036, .036, .02);
    const hl = add(sph, eyeW, g, false); hl.position.set(.014, .018, .058); hl.scale.setScalar(.011);
    return {g, p}; };
  const eyes = [eye(-1), eye(1)];
  const brows = [-1, 1].map(s => { const b = add(new THREE.BoxGeometry(1, 1, 1), dark, F, false); b.position.set(.115 * s, .17, .3); b.scale.set(.11, .022, .02); return b; });
  const nz = add(sph, nose, F, false); nz.position.set(0, -.03, .33); nz.scale.set(.035, .045, .04);
  const mouth = add(sph, lip, F, false); mouth.position.set(0, -.15, .29); mouth.scale.set(.08, .018, .03);
  // hair / hood / cap
  const hairCap = add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * .42), hair, M.headG, false);
  hairCap.scale.setScalar(.352); hairCap.rotation.x = -.35;
  let cap = null, hood = null;
  if (L.cap) {
    const cm = mat(L.cap);
    cap = add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * .5), cm, M.headG, false); cap.scale.setScalar(.36); cap.rotation.x = -.12;
    const brim = add(new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, -Math.PI * .5, Math.PI), cm, M.headG, false); brim.position.set(0, .1, .2); brim.scale.set(.27, .02, .3); brim.rotation.y = Math.PI;
    mats.push(cm); hairCap.visible = false;
  }
  if (L.hood) { hood = add(new THREE.TorusGeometry(.28, .07, 10, 28, Math.PI * 1.25), shirt, M.headG, false); hood.position.set(0, -.25, -.06); hood.rotation.set(Math.PI / 2 + .3, 0, Math.PI * .875); }
  M.face = M.face || {pupil: 1, mouth: 0, brow: 0};
  M.look = {C, mats, eyes, brows, mouth, F};
  M.after = (M) => {
    const P = M.P, r = .075;
    // opacity follows the body (x-ray, ghosts)
    const op = M.mat.opacity; mats.forEach(m => { m.opacity = op; m.depthWrite = op > .8; });
    const neckLow = P.hip.clone().lerp(P.neck, .96);
    bone(C.torso, P.hip.clone().lerp(P.neck, -.04), neckLow, r * 2.35);
    C.collar.position.copy(P.sh); C.collar.scale.set(r * 2.5, r * 1.6, r * 2.5);
    bone(C.sleeveL, P.sh, P.eL.clone().lerp(P.sh, .1), r * 1.45); bone(C.sleeveR, P.sh, P.eR.clone().lerp(P.sh, .1), r * 1.45);
    C.hipBall.position.copy(P.hip); C.hipBall.scale.setScalar(r * 2.1);
    bone(C.thighL, P.hip, P.kL, r * 1.45); bone(C.thighR, P.hip, P.kR, r * 1.45);
    bone(C.shinL, P.kL, P.fL.clone().lerp(P.kL, .06), r * 1.3); bone(C.shinR, P.kR, P.fR.clone().lerp(P.kR, .06), r * 1.3);
    for (const [s, f] of [[C.shoeL, P.fL], [C.shoeR, P.fR]]) { s.position.copy(f).add(new THREE.Vector3(0, -.01, .07)); s.scale.set(.15, .1, .3); }
    // expression
    const fc = M.face, pu = fc.pupil ?? 1, mo = fc.mouth ?? 0, br = fc.brow ?? 0;
    eyes.forEach(e => e.p.scale.set(.036 * pu, .036 * pu, .02));
    brows.forEach((b, i) => { const s = i ? 1 : -1; b.position.y = .17 + .03 * br; b.rotation.z = s * .38 * Math.max(0, -br) - s * .12 * Math.max(0, br); });
    mouth.scale.set(.08 - .025 * mo, .018 + .06 * mo, .03); mouth.position.y = -.15 - .02 * mo;
  };
  return M;
}

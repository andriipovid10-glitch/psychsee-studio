// X-ray head interior: cortex (gyri), cerebellum, brainstem + spinal cord, eyes, optic nerves/chiasm/tracts,
// thalamus, optic radiations -> visual cortex, amygdala, hypothalamus + pituitary.
// Built in millimetres in an anatomical frame (X = lateral, Y = up, Z = anterior; origin ~ anterior commissure),
// then scaled into the stickman head. Positions follow MNI-style landmarks (stylised, not to exact scale):
//   eyes (±32,-32,62) · optic chiasm (0,-18,8) · amygdala (±23,-20,-4) deep in the medial temporal lobe
//   hypothalamus (0,-10,-3) midline at the base, pituitary below it · LGN (±22,-6,-25) · V1 occipital pole (±10,2,-95)
import {THREE, rng, clamp} from './core.js';

export const MM = .0028;          // world units per mm
export const OFFSET = new THREE.Vector3(0, -10, 17).multiplyScalar(MM); // brain centre -> head centre

// ---------------------------------------------------------------- noise (seeded gradient noise)
function makeNoise(seed) {
  const r = rng(seed), p = new Uint8Array(512), g = [];
  for (let i = 0; i < 256; i++) { p[i] = i; const a = r() * Math.PI * 2, z = r() * 2 - 1, s = Math.sqrt(1 - z * z); g.push([s * Math.cos(a), s * Math.sin(a), z]); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const f = t => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = f(x), v = f(y), w = f(z);
    const d = (h, a, b, c) => { const q = g[p[h]]; return q[0] * a + q[1] * b + q[2] * c; };
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(d(AA, x, y, z), d(BA, x - 1, y, z), u), l(d(AB, x, y - 1, z), d(BB, x - 1, y - 1, z), u), v),
      l(l(d(AA + 1, x, y, z - 1), d(BA + 1, x - 1, y, z - 1), u), l(d(AB + 1, x, y - 1, z - 1), d(BB + 1, x - 1, y - 1, z - 1), u), v), w);
  };
}
const N = makeNoise(7);

// ---------------------------------------------------------------- SDF shapes
const ell = (p, c, r) => {
  const qx = (p[0] - c[0]) / r[0], qy = (p[1] - c[1]) / r[1], qz = (p[2] - c[2]) / r[2];
  const k0 = Math.hypot(qx, qy, qz), k1 = Math.hypot(qx / r[0], qy / r[1], qz / r[2]);
  return k0 * (k0 - 1) / (k1 || 1e-6);
};
const smin = (a, b, k) => { const h = clamp(.5 + .5 * (b - a) / k); return b + (a - b) * h - k * h * (1 - h); };
function hemi(p) {           // right hemisphere (x > 0)
  const dome = ell(p, [33, 22, -10], [33, 55, 80]);
  const front = ell(p, [26, 8, 38], [27, 36, 34]);
  const occ = ell(p, [24, 6, -72], [26, 34, 32]);
  const temp = ell(p, [45, -22, -12], [21, 21, 44]);
  let d = smin(smin(dome, front, 8), occ, 8);
  d = smin(d, temp, 3.5);                         // small k keeps the lateral (Sylvian) fissure as a crease
  return Math.max(d, 1.6 - p[0]);                 // medial surface (longitudinal fissure)
}
const cereb = p => ell(p, [22, -35, -66], [27, 19, 25]);

// cast rays from centre c outwards, place each sphere vertex on the outermost surface, then fold it
function shellFromSDF(sdf, c, wseg, hseg, fold) {
  const geo = new THREE.SphereGeometry(1, wseg, hseg); const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    let lo = 0, hi = 0;
    for (let t = 170; t > 0; t -= 1.5) { if (sdf([c[0] + u[0] * t, c[1] + u[1] * t, c[2] + u[2] * t]) < 0) { lo = t; hi = t + 1.5; break; } }
    for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (sdf([c[0] + u[0] * m, c[1] + u[1] * m, c[2] + u[2] * m]) < 0) lo = m; else hi = m; }
    let r = lo; const p = [c[0] + u[0] * r, c[1] + u[1] * r, c[2] + u[2] * r];
    r += fold(p);
    pos.setXYZ(i, c[0] + u[0] * r, c[1] + u[1] * r, c[2] + u[2] * r);
  }
  geo.computeVertexNormals(); return geo;
}
// sulci: grooves where the noise crosses zero
const gyri = p => { const n = N(p[0] / 17, p[1] / 17, p[2] / 17) + .35 * N(p[0] / 8 + 9, p[1] / 8, p[2] / 8); return 3.0 * (Math.min(Math.abs(n) * 2.6, 1) - 1); };
const folia = p => -1.6 * Math.pow(Math.abs(Math.sin(p[1] * .55 + p[2] * .12 + N(p[0] / 20, p[1] / 20, p[2] / 20) * 2)), 3);

// ---------------------------------------------------------------- materials
const GLASS_V = `attribute float vis;varying float vVis;varying vec3 vN,vV,vP;
void main(){vVis=vis;vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`;
const GLASS_F = `uniform vec3 cBase,cHot;uniform float hot,inten,core,visGrey,time,pw;varying float vVis;varying vec3 vN,vV,vP;
void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),pw);float side=gl_FrontFacing?1.:.45;
 vec3 col=mix(cBase,cHot,hot);float a=(core+(1.-core)*f)*inten*side;
 if(visGrey>0.){float h=step(.5,fract((vP.y*.8+vP.x*.3)*.16-time*.9));vec3 g=vec3(.52,.55,.6)*(.55+.45*h);
   col=mix(col,g,vVis*visGrey);a=mix(a,(.22+.7*f)*(.55+.45*h)*side,vVis*visGrey);}
 gl_FragColor=vec4(col*a,1.);}`;
export function glassMat(base, hot = 0xff2a33, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {cBase: {value: new THREE.Color(base)}, cHot: {value: new THREE.Color(hot)}, hot: {value: 0}, inten: {value: o.inten ?? 1},
      core: {value: o.core ?? .06}, visGrey: {value: 0}, time: {value: 0}, pw: {value: o.pw ?? 2.2}},
    vertexShader: GLASS_V, fragmentShader: GLASS_F, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
  });
}
// pathways: base glow + travelling pulse (head p along the tube, 0..1) + permanent fill
const PATH_F = `uniform vec3 c0,c1,cf;uniform float a0,p,w,pk,fill,fk,time,dash;varying vec2 vUv;
void main(){float x=vUv.x;float d=x-p;float pu=exp(-d*d/(w*w))+.45*exp(d/(w*3.))*step(d,0.)*step(p-x,.5);
 float fl=step(x,fill)*fk*(dash>0.?(.55+.45*step(.5,fract(x*28.-time*dash))):1.);
 vec3 c=c0*a0+c1*pu*pk+cf*fl;gl_FragColor=vec4(c,1.);}`;
export function pathMat(c0, c1, a0 = .25) {
  return new THREE.ShaderMaterial({
    uniforms: {c0: {value: new THREE.Color(c0)}, c1: {value: new THREE.Color(c1)}, cf: {value: new THREE.Color(c1)}, a0: {value: a0},
      p: {value: -1}, w: {value: .06}, pk: {value: 0}, fill: {value: 0}, fk: {value: 0}, time: {value: 0}, dash: {value: 0}},
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: PATH_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
}
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const curve = pts => new THREE.CatmullRomCurve3(pts.map(p => v(...p)), false, 'centripetal');

// ---------------------------------------------------------------- build
export function makeBrain(parent) {
  const G = new THREE.Group(); G.scale.setScalar(MM); G.position.copy(OFFSET); parent.add(G);
  const B = {G, mats: {}, parts: {}, paths: {}};
  // cortex: two hemispheres; vertex attribute 'vis' marks the visual cortex (occipital pole + calcarine)
  const ctxMat = glassMat(0x9cc4ff, 0xff2a33, {core: .02, inten: .55, pw: 2.6});
  for (const s of [1, -1]) {
    const geo = shellFromSDF(hemi, [26, 6, -12], 180, 130, gyri);
    if (s < 0) { geo.scale(-1, 1, 1); const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } geo.computeVertexNormals(); }
    const P = geo.attributes.position, vis = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) { const dx = P.getX(i) - s * 9, dy = P.getY(i) - 4, dz = P.getZ(i) + 100; vis[i] = clamp((40 - Math.hypot(dx * 1.1, dy, dz * .8)) / 18); }
    geo.setAttribute('vis', new THREE.BufferAttribute(vis, 1));
    const m = new THREE.Mesh(geo, ctxMat); m.renderOrder = 5; G.add(m);
  }
  B.mats.cortex = ctxMat;
  const cbMat = glassMat(0x86a8e6, 0xff2a33, {core: .04, inten: .8});
  for (const s of [1, -1]) {
    const geo = shellFromSDF(p => cereb([Math.abs(p[0]), p[1], p[2]]), [s * 22, -35, -66], 90, 70, folia);
    const m = new THREE.Mesh(geo, cbMat); m.renderOrder = 4; G.add(m);
  }
  B.mats.cereb = cbMat;
  // brainstem (midbrain -> pons -> medulla) and spinal cord, as a lathe-like tube with varying radius
  const stemC = curve([[0, 2, -16], [0, -12, -20], [0, -30, -24], [0, -48, -30], [0, -66, -34], [0, -90, -36], [0, -125, -36]]);
  const stemGeo = new THREE.TubeGeometry(stemC, 80, 1, 24, false);
  { const P = stemGeo.attributes.position, uv = stemGeo.attributes.uv; const tmp = v(0, 0, 0);
    for (let i = 0; i < P.count; i++) { const u = uv.getX(i); const c = stemC.getPointAt(u); tmp.set(P.getX(i), P.getY(i), P.getZ(i)).sub(c);
      const r = 9 + 6 * Math.exp(-Math.pow((u - .26) / .09, 2)) - 3.5 * clamp((u - .45) / .2); tmp.multiplyScalar(r); P.setXYZ(i, c.x + tmp.x, c.y + tmp.y, c.z + tmp.z); }
    stemGeo.computeVertexNormals(); }
  const stemMat = glassMat(0x86a8e6, 0xff2a33, {core: .05, inten: .85});
  G.add(new THREE.Mesh(stemGeo, stemMat)); B.mats.stem = stemMat;
  // thalamus (relay), dim
  const thMat = glassMat(0x9cc4ff, 0xff2a33, {core: .12, inten: .55});
  for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), thMat); m.scale.set(9, 9, 16); m.position.set(s * 11, 4, -18); G.add(m); }
  B.mats.thal = thMat;
  // eyes: glass ball + lens + retina glow at the back
  const eyeMat = glassMat(0xdfeaff, 0xffffff, {core: .05, inten: 1.0, pw: 1.6});
  const retinaMat = new THREE.MeshBasicMaterial({color: 0xbfd6ff, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide});
  B.parts.eyes = [];
  for (const s of [1, -1]) {
    const e = new THREE.Group(); e.position.set(s * 32, -32, 62); G.add(e);
    e.add(new THREE.Mesh(new THREE.SphereGeometry(12, 40, 28), eyeMat));
    const lens = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), eyeMat); lens.scale.set(4.5, 4.5, 2.2); lens.position.z = 9; e.add(lens);
    const iris = new THREE.Mesh(new THREE.TorusGeometry(5.6, .5, 8, 48), eyeMat); iris.position.z = 10.4; e.add(iris);
    const ret = new THREE.Mesh(new THREE.SphereGeometry(11.2, 32, 16, 0, Math.PI * 2, Math.PI * .62, Math.PI * .38), retinaMat); ret.rotation.x = -Math.PI / 2; e.add(ret);
    B.parts.eyes.push(e);
  }
  B.mats.eye = eyeMat; B.mats.retina = retinaMat;
  // pathways (right side = +X; left mirrored)
  const PATHS = {
    nerve: s => [[s * 31, -32, 50], [s * 25, -28, 36], [s * 15, -22, 20], [s * 5, -18.5, 10]],
    tract: s => [[s * 4, -18.5, 7], [s * 12, -15, -4], [s * 19, -10, -16], [s * 22, -6, -25]],
    radiation: s => [[s * 22, -6, -25], [s * 33, -8, -38], [s * 30, -1, -60], [s * 20, 3, -80], [s * 10, 3, -96]],
    lowroad: s => [[s * 22, -6, -25], [s * 22, -10, -18], [s * 24, -16, -10], [s * 23, -20, -4]],
    alarm: s => [[s * 22, -19, -4], [s * 15, -15, -1], [s * 7, -11, -2], [0, -10, -3]],
  };
  const radius = {nerve: 1.9, tract: 1.5, radiation: .9, lowroad: 1.2, alarm: 1.3};
  for (const [k, f] of Object.entries(PATHS)) {
    B.paths[k] = [];
    for (const s of [1, -1]) {
      const c = curve(f(s));
      const col = k === 'lowroad' || k === 'alarm' ? 0xff2a33 : 0xbcd4ff;
      const m = pathMat(0x6f8fd0, col, k === 'lowroad' || k === 'alarm' ? .05 : .3);
      const group = [];
      const n = k === 'radiation' ? 3 : 1;
      for (let j = 0; j < n; j++) {
        const off = (j - (n - 1) / 2) * 2.4;
        const cc = n > 1 ? curve(f(s).map((p, i) => [p[0], p[1] + off * Math.sin(i / (f(s).length - 1) * Math.PI), p[2]])) : c;
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(cc, 64, radius[k], 10, false), m); mesh.renderOrder = 8; G.add(mesh); group.push(mesh);
      }
      B.paths[k].push({mat: m, curve: c, side: s});
    }
  }
  // chiasm crossing bar
  const chiasm = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), pathMat(0x6f8fd0, 0xbcd4ff, .45));
  chiasm.scale.set(7, 2, 4); chiasm.position.set(0, -18.5, 8); G.add(chiasm); B.parts.chiasm = chiasm;
  // descending signal (hypothalamus -> brainstem -> cord), red
  const desc = curve([[0, -10, -3], [0, -14, -12], [0, -30, -24], [0, -48, -30], [0, -66, -34], [0, -90, -36], [0, -125, -36]]);
  const descMat = pathMat(0x6f8fd0, 0xff2a33, 0.0);
  G.add(new THREE.Mesh(new THREE.TubeGeometry(desc, 80, 2.2, 10, false), descMat)); B.paths.desc = [{mat: descMat, curve: desc}];
  // amygdala (almond), hypothalamus, pituitary
  const amyMat = new THREE.MeshStandardMaterial({color: 0x000000, emissive: 0xff1a26, emissiveIntensity: .35, roughness: .4, transparent: true, opacity: .95});
  B.parts.amy = [];
  for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), amyMat); m.scale.set(6, 5.5, 9); m.position.set(s * 23, -20, -4); m.rotation.x = .35; G.add(m); B.parts.amy.push(m); }
  B.mats.amy = amyMat;
  const hypMat = new THREE.MeshStandardMaterial({color: 0x000000, emissive: 0xffa04a, emissiveIntensity: .3, roughness: .4, transparent: true, opacity: .95});
  const hyp = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), hypMat); hyp.scale.set(7, 5, 8); hyp.position.set(0, -10, -3); G.add(hyp);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 12, 12), hypMat); stalk.position.set(0, -19, 1); stalk.rotation.x = -.25; G.add(stalk);
  const pit = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), hypMat); pit.scale.set(6, 4.5, 5); pit.position.set(0, -27, 3); G.add(pit);
  B.parts.hyp = hyp; B.mats.hyp = hypMat;
  // anchors (mm) for labels / camera
  B.A = {eyeR: v(32, -32, 62), eyeL: v(-32, -32, 62), chiasm: v(0, -18.5, 8), lgnR: v(22, -6, -25), amyR: v(23, -20, -4), amyL: v(-23, -20, -4),
    hyp: v(0, -10, -3), pit: v(0, -27, 3), v1R: v(10, 3, -96), v1L: v(-10, 3, -96), centre: v(0, 5, -15), stem: v(0, -40, -28), cord: v(0, -110, -36)};
  B.toWorld = p => G.localToWorld(p.clone());
  return B;
}
// helper: drive a path's pulse. p in 0..1 along the tube, k = intensity
export function setPath(arr, o) { for (const P of arr) { for (const [k, val] of Object.entries(o)) if (k in P.mat.uniforms) P.mat.uniforms[k].value = val; } }

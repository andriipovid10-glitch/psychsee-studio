// EP02 v2 — shared kit for scenes 01+: timing, poses, crowd, kinetic words, photo plates, article cards.
// (scene00 keeps its own inline copies; the behaviour here matches it.)
import {THREE, clamp, lerp, seg, ease, eo, back, V3, vlerp, pose, makeMan, $, show, FPS} from '../../ep02/lib/core.js';
import {dress} from './look.js';
export {dress};

// ---------------------------------------------------------------- timing
export const ORDER = ['s00', 's01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10'];
export async function loadTiming(scene) {
  const T = await (await fetch(`timing_${scene}.json?x=${Date.now()}`)).json();
  let offset = 0;
  for (const s of ORDER) {
    if (s === scene) break;
    try { offset += (await (await fetch(`timing_${s}.json?x=${Date.now()}`)).json()).duration; } catch (e) { /* not built yet */ }
  }
  const cue = (name, dt = 0) => { if (!(name in T.cues)) throw new Error('missing cue ' + name); return T.cues[name] + dt; };
  return {T, cue, offset, duration: T.duration, words: T.words};
}
export function timecode(el, globalT) {
  const fr = Math.floor(globalT * FPS), s = Math.floor(fr / FPS);
  el.textContent = `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(fr % FPS).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- cast
const fistGeo = new THREE.SphereGeometry(1, 24, 16);
export function man(scene, color, look) {
  const M = makeMan(scene, color);
  if (look !== null) dress(M, look || 'c1');
  M.fists = [0, 1].map(() => { const f = new THREE.Mesh(fistGeo, M.mat); f.castShadow = true; M.g.add(f); return f; });
  return M;
}
export function place(M, x, z, face) { M.g.position.set(x, 0, z); M.g.rotation.y = face; }
export function fists(M, sq = 1) { const P = M.P; M.fists[0].position.copy(P.hL); M.fists[1].position.copy(P.hR); M.fists.forEach(f => f.scale.setScalar(.088 * sq)); }
export const tremor = (t, a) => V3(Math.sin(t * 53.1) * a + Math.sin(t * 31.7) * a * .5, Math.cos(t * 47.3) * a, Math.sin(t * 39.9) * a * .4);
// aggressor: o.punch 0..1, o.push 0..1 (two-hand shove)
export function poseA(M, t, o = {}) {
  const br = Math.sin(t * 3.1) * .012, p = o.punch || 0, pp = back(clamp(p)), sh = o.push || 0, sb = back(clamp(sh));
  M.face = {pupil: 1, mouth: .15 + .5 * Math.max(p, sh), brow: -1};
  let uaR = vlerp(V3(-.42, -.88, .12), V3(-.06, .16, 1), pp), laR = vlerp(V3(-.18, -.75, .5), V3(-.03, .08, 1), pp);
  let uaL = V3(.42, -.88 + .3 * p, .12), laL = V3(.18, -.75 + .9 * p, .5);
  if (sh) { uaL = vlerp(uaL, V3(.2, .02, 1), sb); laL = vlerp(laL, V3(.05, .08, 1), sb); uaR = vlerp(uaR, V3(-.2, .02, 1), sb); laR = vlerp(laR, V3(-.05, .08, 1), sb); }
  pose(M, {root: [0, 0, .45 * p + .3 * sh], bob: br, lean: .2 + .16 * p + .22 * sh, headLean: .1, roll: -.05 * p,
    ua: {L: uaL, R: uaR}, la: {L: laL, R: laR},
    th: {L: V3(.15, -.99, .14 + .2 * p + .3 * sh), R: V3(-.15, -.99, -.12 - .15 * p - .2 * sh)}});
  fists(M, 1.05);
}
// "you": guard up, breathing; o.hit 0..1 = staggered back by a shove, o.calm 0..1 = guard down, upright
export function poseB(M, t, o = {}) {
  const rate = o.rate || 4.2, br = Math.sin(t * rate) * (o.breath ?? .014);
  const sh = o.shake || 0, tr = tremor(t, sh), tr2 = tremor(t + 3.3, sh);
  const h = o.hit || 0, cm = o.calm || 0;
  M.face = {pupil: o.pupil ?? (1.15 + .4 * Math.min(1, sh * 10)) * (1 - .3 * cm), mouth: o.mouth ?? (.15 + .5 * h) * (1 - cm), brow: o.brow ?? (.5 - .5 * cm)};
  let ua = {L: V3(.32, -.8, .45), R: V3(-.32, -.8, .45)}, la = {L: V3(.08, .8, .55).add(tr), R: V3(-.08, .8, .55).add(tr2)};
  if (h) { ua = {L: vlerp(ua.L, V3(.55, .35, .75), h), R: vlerp(ua.R, V3(-.7, .05, .7), h)}; la = {L: vlerp(la.L, V3(.35, .75, .55), h), R: vlerp(la.R, V3(-.45, .55, .7), h)}; }
  if (cm) { ua = {L: vlerp(ua.L, V3(.22, -.97, .05), cm), R: vlerp(ua.R, V3(-.22, -.97, .05), cm)}; la = {L: vlerp(la.L, V3(.06, -.99, .1), cm), R: vlerp(la.R, V3(-.06, -.99, .1), cm)}; }
  pose(M, {root: [0, .04 * h, -.42 * h], bob: br, lean: -.03 - .36 * h + br * 1.2 + .05 * cm, headLean: (.14 - .24 * h) * (1 - cm), roll: .06 * h,
    ua, la, th: {L: V3(.16, -.92 + .1 * h, .08 + .45 * h), R: V3(-.14, -.99, -.14)}, sh: {L: V3(.02, -1, -.25 * h), R: V3(-.02, -1, .05)}});
  fists(M, o.squeeze || 1);
}
// bystanders watching: list of [x, z, face, variant]
export function makeCrowd(scene, n = 5) { return Array.from({length: n}, (_, i) => man(scene, 0xc9cfda, 'c' + (1 + i % 5))); }
export function poseCrowd(crowd, L, t, o = {}) {
  crowd.forEach((M, i) => {
    M.g.visible = i < L.length; if (!M.g.visible) return;
    const [x, z, a, v] = L[i]; place(M, x, z, a);
    const br = Math.sin(t * 2.2 + i * 1.7) * .01, lean = [.12, .05, .18][v], yell = o.yell ? .5 + .5 * Math.sin(t * 9 + i * 2) : 0;
    const ua = [{L: V3(.5, -.6, .55), R: V3(-.5, -.6, .55)}, {L: V3(.3, -.95, .05), R: V3(-.3, -.95, .05)}, {L: V3(.4, -.4, .7), R: V3(-.25, -.95, 0)}][v];
    const la = [{L: V3(-.7, .1, .5), R: V3(.7, .15, .5)}, {L: V3(.1, -.99, 0), R: V3(-.1, -.99, 0)}, {L: V3(-.2, .9, .3), R: V3(-.1, -.99, .05)}][v];
    if (yell) { ua.L = vlerp(ua.L, V3(.6, .5, .5), yell); ua.R = vlerp(ua.R, V3(-.6, .5, .5), yell); la.L = vlerp(la.L, V3(.3, .9, .3), yell); la.R = vlerp(la.R, V3(-.3, .9, .3), yell); }
    M.face = {pupil: 1.1, mouth: .1 + .8 * yell, brow: yell ? -.6 : .2};
    pose(M, {bob: br + .02 * yell, lean: lean + .1 * yell, headLean: .1 + .05 * Math.sin(t * .7 + i), roll: .03 * Math.sin(t * .5 + i), ua, la});
    fists(M, .95);
  });
}

// ---------------------------------------------------------------- kinetic words (same feel as scene00)
const spans = el => [...el.querySelectorAll('span')];
export function hideKw() { document.querySelectorAll('.kw').forEach(e => show(e, 0)); }
export function slam(el, t, t0, t1, o = {}) {
  if (t < t0 || t > t1 + .12) return;
  const k = seg(t, t0, t0 + (o.dur || .22)), s = lerp(o.from || 1.55, 1, back(k));
  const j = (1 - seg(t, t0, t0 + .3)) * (o.jolt ?? 14), out = seg(t, t1 - .02, t1 + .12);
  el.style.transform = `translate(-50%,-50%) translate(${Math.sin(t * 97) * j}px,${Math.cos(t * 83) * j}px) scale(${s * (1 + .04 * out)})`;
  el.style.filter = `blur(${(1 - clamp(k * 1.4)) * 12 + out * 8}px)`;
  show(el, clamp(k * 3) * (1 - out));
}
export function slamWords(el, t, times, t1, o = {}) {
  if (t < times[0] || t > t1 + .12) return;
  const out = seg(t, t1 - .02, t1 + .12); show(el, 1 - out);
  el.style.transform = 'translate(-50%,-50%)'; el.style.filter = out ? `blur(${out * 8}px)` : 'none';
  spans(el).forEach((sp, i) => {
    const t0 = times[Math.min(i, times.length - 1)], k = seg(t, t0, t0 + .2), j = (1 - seg(t, t0, t0 + .28)) * (o.jolt ?? 10);
    sp.style.opacity = clamp(k * 3);
    sp.style.transform = `translate(${Math.sin(t * 97 + i) * j}px,${Math.cos(t * 83 + i) * j}px) scale(${lerp(o.from || 1.5, 1, back(k))})`;
  });
}
export const KW_CSS = `
#tl,#tr,#bl,#tclock,#fz{display:none!important}
.kw{position:absolute;font-weight:900;letter-spacing:-.045em;line-height:.9;white-space:nowrap;transform-origin:50% 50%;will-change:transform;visibility:hidden;text-shadow:0 6px 40px rgba(0,0,0,.55)}
.kw span{display:inline-block;will-change:transform}
.kw .r{color:#ff3340;text-shadow:0 0 40px rgba(255,40,60,.45),0 6px 40px rgba(0,0,0,.55)}
.kw .b{color:#7fb2ff;text-shadow:0 0 40px rgba(127,178,255,.5),0 6px 40px rgba(0,0,0,.55)}
.kw.sm{font-family:'DejaVu Sans Mono',monospace;font-size:26px;letter-spacing:.3em;font-weight:400;color:#8a97b3;text-shadow:none}
#rflash{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(255,30,45,0) 35%,rgba(255,30,45,.55) 100%);opacity:0;pointer-events:none}
#blackout{position:absolute;inset:0;background:#000}`;

// ---------------------------------------------------------------- photo plates (DOM, cheap): Ken Burns + red glow pulse
// <div class="plate" id=...><img src=...><i class="glow"></i></div>
export const PLATE_CSS = `
.plate{position:absolute;inset:0;overflow:hidden;visibility:hidden;background:#05070d}
.plate img{position:absolute;left:0;top:0;width:1920px;height:1080px;object-fit:cover;transform-origin:50% 50%;will-change:transform,filter}
.plate .glow{position:absolute;width:520px;height:520px;margin:-260px 0 0 -260px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,60,70,.85) 0%,rgba(255,30,45,.35) 30%,rgba(255,30,45,0) 70%);mix-blend-mode:screen;opacity:0}
.plate .shade{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 40%,rgba(3,6,14,.75) 100%)}`;
// o: {zoom0, zoom1, x0,y0,x1,y1 (px pan), glowX, glowY (px in the image), glow (0..1), blur, bright}
export function plate(el, k, o = {}) {
  const img = el.querySelector('img'), g = el.querySelector('.glow');
  const z = lerp(o.zoom0 ?? 1.04, o.zoom1 ?? 1.16, k), x = lerp(o.x0 || 0, o.x1 || 0, k), y = lerp(o.y0 || 0, o.y1 || 0, k);
  img.style.transform = `translate(${x}px,${y}px) scale(${z})`;
  img.style.filter = `brightness(${o.bright ?? 1}) saturate(${o.sat ?? 1}) blur(${o.blur || 0}px)`;
  if (g) {
    // glow follows the image point through the same transform (origin = centre)
    const gx = 960 + (o.glowX - 960) * z + x, gy = 540 + (o.glowY - 540) * z + y;
    g.style.left = gx + 'px'; g.style.top = gy + 'px'; g.style.opacity = o.glow || 0; g.style.transform = `scale(${.6 + .8 * (o.glow || 0)})`;
  }
}

// ---------------------------------------------------------------- article / definition card (editorial paper that scrolls)
// Ref: "Navier Stokes Visual Essay" (@ashebytes) for the editorial page + scroll, "Scroll Animated Text Reveal" (Vanguardia)
// for the highlighter pill reveal. Our own text and layout (no real publication's branding).
export const PAPER_CSS = `
.paper{position:absolute;left:50%;top:50%;width:1040px;visibility:hidden;perspective:2200px;transform:translate(-50%,-50%)}
.paper .sheet{position:relative;background:#f2efe8;color:#16181d;border-radius:14px;padding:64px 84px 120px;box-shadow:0 60px 140px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.06);
  transform-origin:50% 0;will-change:transform}
.paper .kicker{font-family:'DejaVu Sans Mono',monospace;font-size:19px;letter-spacing:.14em;text-transform:uppercase;color:#7a7f8c;display:flex;justify-content:space-between}
.paper h1{font-family:'DejaVu Serif',Georgia,serif;font-weight:700;font-size:96px;letter-spacing:-.02em;margin:26px 0 6px;line-height:1}
.paper .pron{font-family:'DejaVu Serif',serif;font-style:italic;font-size:30px;color:#5d6270;margin-bottom:28px}
.paper .rule{height:2px;background:#16181d;margin:24px 0 30px;transform-origin:0 50%}
.paper p{font-family:'DejaVu Serif',Georgia,serif;font-size:34px;line-height:1.5;margin:0 0 26px;color:#262a33}
.paper .hl{position:relative;z-index:0;white-space:nowrap}
.paper .hl i{position:absolute;left:-6px;right:-6px;top:6px;bottom:2px;background:#ff3340;opacity:.28;border-radius:6px;transform-origin:0 50%;transform:scaleX(0);z-index:-1}
.paper .fig{display:flex;align-items:center;gap:28px;margin:10px 0 30px;padding:24px 28px;background:#e6e2d8;border-radius:10px}
.paper .fig b{font-family:Inter,sans-serif;font-weight:900;font-size:110px;letter-spacing:-.05em;color:#d6202c;line-height:.9}
.paper .fig span{font-family:'DejaVu Sans Mono',monospace;font-size:20px;letter-spacing:.08em;text-transform:uppercase;color:#4a4f5c;line-height:1.5}
.paper .src{font-family:'DejaVu Sans Mono',monospace;font-size:18px;color:#7a7f8c;letter-spacing:.04em}`;
// k: 0..1 overall progress; o: {in:[t0,t1] entrance, scroll px, hl:[[t0,t1]...] per .hl span, tilt}
export function paper(el, t, o) {
  const [a, b] = o.span, kin = eo(seg(t, a, a + .55)), kout = seg(t, b - .3, b);
  if (t < a || t > b) { show(el, 0); return; }
  show(el, 1 - kout);
  const sheet = el.querySelector('.sheet');
  const sc = seg(t, a + .35, b - .1);
  const y = lerp(380, 0, kin) - (o.scroll || 0) * ease(sc), rx = lerp(28, o.tilt ?? 9, kin), rz = lerp(-4, -1.2, kin);
  sheet.style.transform = `translateY(${y}px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${lerp(.9, 1, kin) * (1 + .03 * sc)})`;
  el.style.filter = `blur(${(1 - kin) * 10 + kout * 10}px)`;
  [...el.querySelectorAll('.hl i')].forEach((m, i) => { const [h0, h1] = (o.hl || [])[i] || [1e9, 1e9]; m.style.transform = `scaleX(${eo(seg(t, h0, h1))})`; });
  const rule = el.querySelector('.rule'); if (rule) rule.style.transform = `scaleX(${eo(seg(t, a + .2, a + .8))})`;
}

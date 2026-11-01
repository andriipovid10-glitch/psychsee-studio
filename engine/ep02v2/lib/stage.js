// EP02 v2 — light stage: same look as ep02 (navy, cool rim, soft shadows, selective-desat grade) but cheap enough
// for a 2-core CPU renderer: render resolution scales with ?s= (0.5 = 960x540 draft), no bloom, 1024 shadow map.
import {THREE, NAVY} from '../../ep02/lib/core.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export const SCALE = +(new URLSearchParams(location.search).get('s') || 1);

const GRADE = {
  uniforms: {tDiffuse: {value: null}, desat: {value: 0}, vign: {value: .4}, grain: {value: .016}, seed: {value: 0},
    ca: {value: 0}, flash: {value: 0}, red: {value: 0}, black: {value: 0}, res: {value: new THREE.Vector2(1920, 1080)}},
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform float desat,vign,grain,seed,ca,flash,red,black;uniform vec2 res;varying vec2 vUv;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*43758.5453);}
  void main(){vec2 d=vUv-.5;vec2 o=d*ca/res.x*2.;
    vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
    float redness=clamp((c.r-max(c.g,c.b))*2.5,0.,1.);
    float l=dot(c,vec3(.299,.587,.114));c=mix(c,mix(vec3(l)*vec3(.92,.97,1.08),c,redness),desat);
    float r=length(d*vec2(1.,.62));c*=1.-vign*smoothstep(.25,.85,r);
    c+=vec3(.9,.05,.08)*red*smoothstep(.15,.8,r);
    c+=(h(vUv*res)-.5)*grain;c=mix(c,vec3(1.),flash);c*=1.-black;gl_FragColor=vec4(c,1.);}`
};

export function setupStage(canvas) {
  const w = Math.round(1920 * SCALE), h = Math.round(1080 * SCALE);
  canvas.width = w; canvas.height = h;
  const R = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  R.setPixelRatio(1); R.setSize(w, h, false);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NAVY);
  scene.fog = new THREE.Fog(NAVY, 9, 24);
  const cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.02, 100);
  const hemi = new THREE.HemisphereLight(0x8fa6d6, NAVY, .55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-4, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 5;
  Object.assign(key.shadow.camera, {left: -5, right: 5, top: 5, bottom: -5}); key.shadow.bias = -0.0006;
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(0x7fb2ff, 3.0); rim.position.set(5, 4, -6); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({opacity: .55}));
  ground.rotation.x = -Math.PI / 2; ground.position.y = .002; ground.receiveShadow = true; scene.add(ground);
  const composer = new EffectComposer(R); composer.setPixelRatio(1); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, cam));
  const grade = new ShaderPass(GRADE); grade.uniforms.res.value.set(w, h); composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {R, scene, cam, composer, grade: grade.uniforms, key, rim, hemi, ground};
}

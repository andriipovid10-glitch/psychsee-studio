// EP02 renderer. Serve the repo root first:  python3 -m http.server 8765
//   node engine/ep02/render.js s00 renders/ep02/scene00.mp4            full scene (parallel workers)
//   node engine/ep02/render.js s00 renders/ep02/stills/s00 2.5,8.3     check stills (JPEG)
//   env WORKERS=3 (default 3), PORT=8765
const {chromium} = require('playwright');
const {spawn, execFileSync} = require('child_process');
const fs = require('fs'), path = require('path');
const FPS = 30, PORT = process.env.PORT || 8765;
const PAGES = {s00: 'scene00.html', s01: 'scene01.html'};

async function open(scene) {
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
  page.on('console', m => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
  page.on('pageerror', e => console.error('PAGEERR:', e.message));
  await page.goto(`http://localhost:${PORT}/engine/ep02/${PAGES[scene]}`);
  await page.waitForFunction(() => window.ready === true, null, {timeout: 120000});
  return {browser, page};
}

async function chunk(scene, out, f0, f1) {
  const {browser, page} = await open(scene);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], {stdio: ['pipe', 'ignore', 'inherit']});
  const t0 = Date.now();
  for (let i = f0; i < f1; i++) {
    await page.evaluate(t => draw(t), i / FPS);
    const buf = await page.screenshot({type: 'jpeg', quality: 92});
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - f0) % 90 === 0) console.log(scene, `frames ${f0}-${f1}`, i, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  ff.stdin.end();
  const code = await new Promise(r => ff.on('close', r));
  await browser.close();
  if (code !== 0) throw new Error('ffmpeg failed ' + out);
}

(async () => {
  const [scene, out, stills] = process.argv.slice(2);
  if (stills) {
    const {browser, page} = await open(scene);
    fs.mkdirSync(path.dirname(out), {recursive: true});
    for (const s of stills.split(',')) {
      await page.evaluate(t => draw(t), parseFloat(s));
      await page.screenshot({path: `${out}_${s}.jpg`, type: 'jpeg', quality: 85});
    }
    await browser.close(); return;
  }
  if (process.argv[5] === '--chunk') {   // internal: one worker
    await chunk(scene, out, +process.argv[6], +process.argv[7]); return;
  }
  const timing = JSON.parse(fs.readFileSync(path.join(__dirname, `timing_${scene}.json`)));
  const n = Math.round(timing.duration * FPS);
  const workers = +(process.env.WORKERS || 3);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  const tmpDir = out + '.parts'; fs.mkdirSync(tmpDir, {recursive: true});
  const per = Math.ceil(n / workers), parts = [];
  const jobs = [];
  for (let w = 0; w < workers; w++) {
    const f0 = w * per, f1 = Math.min(n, f0 + per); if (f0 >= f1) break;
    const p = path.join(tmpDir, `part${w}.mp4`); parts.push(p);
    jobs.push(new Promise((res, rej) => {
      const c = spawn(process.execPath, [__filename, scene, p, '', '--chunk', f0, f1], {stdio: 'inherit'});
      c.on('close', code => code === 0 ? res() : rej(new Error('worker ' + w + ' failed')));
    }));
  }
  await Promise.all(jobs);
  const list = path.join(tmpDir, 'list.txt');
  fs.writeFileSync(list, parts.map(p => `file '${path.resolve(p)}'`).join('\n'));
  const tmp = out.replace(/\.mp4$/, '.part.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', tmp]);
  fs.renameSync(tmp, out); fs.rmSync(tmpDir, {recursive: true});
  console.log('wrote', out, n, 'frames');
})().catch(e => { console.error(e); process.exit(1); });

const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const [variant, out, stills] = process.argv.slice(2);
  const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', m => { if (m.type()==='error') console.error('PAGE:', m.text()); });
  page.on('pageerror', e => console.error('PAGEERR:', e.message));
  await page.goto('http://localhost:8765/engine/reference-ep00/scene.html?v=' + variant);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  if (stills) {
    for (const s of stills.split(',')) { await page.evaluate(t => draw(t), parseFloat(s));
      await page.screenshot({ path: `${out}_${s}.jpg`, type: 'jpeg', quality: 85 }); }
    await browser.close(); return; }
  const fps = 30, dur = 11, n = Math.round(fps * dur);
  const tmp = out.replace(/\.mp4$/, '.part.mp4');
  const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-',
    '-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',tmp], { stdio: ['pipe','ignore','inherit'] });
  const t0=Date.now();
  for (let i = 0; i < n; i++) { await page.evaluate(t => draw(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if(i%60===0) console.log(variant, i, ((Date.now()-t0)/1000).toFixed(0)+'s'); }
  ff.stdin.end();
  await new Promise(r => ff.on('close', c => { if (c === 0) require('fs').renameSync(tmp, out); r(); }));
  await browser.close();
})();

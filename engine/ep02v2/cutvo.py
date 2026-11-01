"""Cut whole sentences out of a scene's VO (audio + word times + script text), keeping timing consistent.

usage: python3 engine/ep02v2/cutvo.py s07 "Almost everyone says it: time slowed down." "If time really slowed down, they'd be able to read them."
Then re-run: python3 engine/ep02v2/align.py s07
Each phrase must match consecutive words of the VO (punctuation/case ignored). The audio is removed from the
first word's start to the next kept word's start, so the pause before the following sentence is kept once.
"""
import json, os, re, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
scene, phrases = sys.argv[1], sys.argv[2:]
norm = lambda w: re.sub(r"[^a-z0-9']", '', w.lower().replace('’', "'"))
apath = os.path.join(ROOT, f'audio/ep02v2/vo_temp_{scene}.wav'); jpath = os.path.join(HERE, f'asr/vo_temp_{scene}.asr.json')
J = json.load(open(jpath)); W = J['words']
sr = 48000
x = np.frombuffer(subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', apath, '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'], capture_output=True).stdout, np.float32)
cuts = []
for ph in phrases:
    toks = [norm(t) for t in ph.split() if norm(t)]
    wn = [norm(w['text']) for w in W]
    i = next((i for i in range(len(wn) - len(toks) + 1) if wn[i:i + len(toks)] == toks), None)
    if i is None: sys.exit(f'phrase not found: {ph}')
    j = i + len(toks)
    a = W[i]['start_ms'] / 1000 - .06
    b = (W[j]['start_ms'] / 1000 - .06) if j < len(W) else (W[i - 1]['end_ms'] / 1000 + .5 if i else len(x) / sr)
    cuts.append((a, b, i, j))
cuts.sort()
keep, t, removed = [], 0.0, set()
for a, b, i, j in cuts:
    keep.append(x[int(t * sr):int(a * sr)]); t = b; removed |= set(range(i, j))
keep.append(x[int(t * sr):])
y = np.concatenate(keep)
fade = 240
pos = 0
for k in keep[:-1]:            # tiny crossfade-free fades at the joins (joins sit in pauses)
    pos += len(k)
    y[max(0, pos - fade):pos] *= np.linspace(1, 0, min(fade, pos))
    y[pos:pos + fade] *= np.linspace(0, 1, len(y[pos:pos + fade]))
def shift(ms):
    s = ms / 1000
    return round((s - sum(min(b, s) - a for a, b, _, _ in cuts if s > a)) * 1000)
J['words'] = [dict(w, start_ms=shift(w['start_ms']), end_ms=shift(w['end_ms'])) for k, w in enumerate(W) if k not in removed]
json.dump(J, open(jpath, 'w'), indent=0)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-', apath], input=y.astype(np.float32).tobytes(), check=True)
# script text
sp = os.path.join(ROOT, 'scripts/ep02-v2.md'); s = open(sp, encoding='utf-8').read()
for ph in phrases:
    if ph in s: s = s.replace(' ' + ph, '').replace(ph + ' ', '').replace(ph, '')
    else: print('note: phrase not found verbatim in script text, edit it by hand:', ph)
open(sp, 'w', encoding='utf-8').write(s)
print(f'{scene}: cut {sum(b - a for a, b, _, _ in cuts):.2f}s -> {len(y) / sr:.2f}s')

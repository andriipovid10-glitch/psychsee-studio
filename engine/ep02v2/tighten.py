"""Tighten a TTS take: shorten long pauses, speed up slightly, and carry the ASR word times through the edit.

usage: python3 engine/ep02v2/tighten.py SRC.wav WORDS.json OUT.wav OUT.asr.json [--t0 S] [--t1 S] [--tempo 1.05] [--pause .26]
  WORDS.json = {"words": [{"text", "start_ms", "end_ms"}]} (Speko audio.transcribe with word_timestamps)
  --t0/--t1   = keep only this part of the take (seconds); words outside are dropped
Long pauses after sentence ends keep a little more air (KEEP_END) so the read still breathes.
"""
import argparse, json, re, subprocess
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('words'); ap.add_argument('out'); ap.add_argument('out_asr')
ap.add_argument('--t0', type=float, default=0); ap.add_argument('--t1', type=float, default=1e9)
ap.add_argument('--tempo', type=float, default=1.05); ap.add_argument('--pause', type=float, default=.26)
o = ap.parse_args()
KEEP_END = .42   # pause kept after . ? ! …

W = [(w['text'], w['start_ms'] / 1000, w['end_ms'] / 1000) for w in json.load(open(o.words))['words']]
W = [w for w in W if w[1] >= o.t0 - .05 and w[2] <= o.t1 + .05]
sr = 24000
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', o.src, '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.float32)
a0 = max(0, W[0][1] - .12); a1 = min(len(x) / sr, W[-1][2] + .25)
x = x[int(a0 * sr):int(a1 * sr)]
W = [(t, a - a0, b - a0) for t, a, b in W]
log = subprocess.run(['ffmpeg', '-hide_banner', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-', '-af', 'silencedetect=n=-40dB:d=0.22', '-f', 'null', '-'],
                     input=x.tobytes(), capture_output=True).stderr.decode()
S = [float(v) for v in re.findall(r'silence_start: (-?[\d.]+)', log)]; E = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', log)]
cuts = []
for s, e in zip(S, E):
    if s < .05: continue
    prev = max((w for w in W if w[2] <= s + .25), key=lambda w: w[2], default=None)
    keep = KEEP_END if prev and re.search(r'[.?!…]$', prev[0]) else o.pause
    if e - s > keep: cuts.append((s + keep / 2, e - keep / 2))
pieces, t = [], 0.0
for a, b in cuts: pieces.append(x[int(t * sr):int(a * sr)]); t = b
pieces.append(x[int(t * sr):])
y = np.concatenate(pieces).astype(np.float32)
mp = lambda ts: (ts - sum(min(b, ts) - a for a, b in cuts if ts > a)) / o.tempo
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-', '-af', f'atempo={o.tempo}', '-ar', '48000', o.out],
               input=y.tobytes(), check=True)
words = [{'text': w, 'start_ms': round(mp(a) * 1000), 'end_ms': round(mp(b) * 1000)} for w, a, b in W]
json.dump({'source': f'Speko transcription mapped through pause-tightening + atempo {o.tempo}', 'words': words}, open(o.out_asr, 'w'), indent=0)
print(f'{o.out}: {len(cuts)} pauses cut, {len(y) / sr / o.tempo:.2f}s')

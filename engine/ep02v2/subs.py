"""EP02 subtitles: word timings (timing_sNN.json) -> sentence-level cues -> SRT.
usage: python3 engine/ep02v2/subs.py OUT.srt [translations.json]   (translations: list of strings, one per cue, same order)"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ['s%02d' % i for i in range(11)]
T = {s: json.load(open(os.path.join(HERE, f'timing_{s}.json'))) for s in ORDER}
W, off = [], 0.0
for s in ORDER:
    W += [(w['w'], w['start'] + off, w['end'] + off) for w in T[s]['words']]
    off += T[s]['duration']
cues, cur = [], []
for w in W:
    cur.append(w)
    txt = ' '.join(x[0] for x in cur)
    if re.search(r'[.?!…]["”]?$', w[0]) or (len(txt) > 60 and re.search(r'[,—:;]$', w[0])) or len(txt) > 100:
        cues.append(cur); cur = []
if cur: cues.append(cur)
def ts(x): ms = int(round(x * 1000)); return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'
tr = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
out = []
for i, c in enumerate(cues):
    a = c[0][1]; b = max(c[-1][2] + .25, a + .9)
    if i + 1 < len(cues): b = min(b, cues[i + 1][0][1] - .02)
    text = tr[i] if tr else ' '.join(x[0] for x in c)
    if len(text) > 42 and '\n' not in text:   # two balanced lines
        ws = text.split(); best = min(range(1, len(ws)), key=lambda k: abs(len(' '.join(ws[:k])) - len(' '.join(ws[k:]))))
        text = ' '.join(ws[:best]) + '\n' + ' '.join(ws[best:])
    out.append(f'{i + 1}\n{ts(a)} --> {ts(b)}\n{text}\n')
open(sys.argv[1], 'w').write('\n'.join(out))
if not tr: json.dump([' '.join(x[0] for x in c) for c in cues], open(sys.argv[1] + '.lines.json', 'w'), indent=0, ensure_ascii=False)
print(len(cues), 'cues ->', sys.argv[1])

"""Word timing for EP02 v2 scenes -> engine/ep02v2/timing_sNN.json

The animation never uses hard-coded seconds: every beat is a cue word (see cues.json).
This script finds when each word of the section's VO (taken verbatim from the script)
is spoken in the recording, then writes word times + cue times.

usage:
  python3 engine/ep02v2/align.py s00                     # auto: audio/ep02v2/vo_s00.wav, else vo_temp_s00.wav
  python3 engine/ep02v2/align.py s00 --audio my.wav
  python3 engine/ep02v2/align.py s00 --asr words.json    # word timestamps from any ASR (Speko / whisper json)
  python3 engine/ep02v2/align.py s00 --backend silence   # force the no-model fallback

Backends, tried in this order unless --asr / --backend is given:
  1. an ASR json next to the audio: <audio>.asr.json or engine/ep02v2/asr/<audio-name>.asr.json
  2. faster-whisper (pip install faster-whisper; downloads the model once, needs internet to huggingface.co)
  3. silence detection + the known script text (no model; ~0.1-0.3 s accurate on clean VO)
"""
import argparse, difflib, json, os, re, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
NUM = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven',
       '8': 'eight', '9': 'nine', '10': 'ten', '31': 'thirty-one'}


def norm(w):
    w = w.lower().replace('’', "'").replace('‘', "'")
    w = re.sub(r"[^a-z0-9'\-]", '', w).strip("-'")
    return NUM.get(w, w)


def script_vo(script_path, section):
    """Return the VO text of '## // NN' section, verbatim."""
    txt = open(script_path, encoding='utf-8').read()
    m = re.search(r'^## ' + re.escape(section) + r'.*?$(.*?)(?=^## |\Z)', txt, re.M | re.S)
    if not m: sys.exit(f'section {section} not found in {script_path}')
    body = m.group(1)
    vo = body.split('VO:', 1)[1]
    vo = vo.split('\n---', 1)[0]
    return ' '.join(l.strip() for l in vo.strip().splitlines() if l.strip())


def tokens(text):
    out = []
    for raw in text.split():
        n = norm(raw)
        if n: out.append({'w': raw, 'n': n, 'punct': bool(re.search(r'[.,!?;:…—]$', raw))})
    return out


def load_audio(path, sr=16000):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32), sr


# ---------------------------------------------------------------- backends
def asr_from_json(path):
    d = json.load(open(path))
    k = d.get('time_scale', 1.0)
    words = d.get('words') or [w for s in d.get('segments', []) for w in s.get('words', [])]
    out = []
    for w in words:
        t = w.get('text', w.get('word', ''))
        if 'start_ms' in w: a, b = w['start_ms'] / 1000, w['end_ms'] / 1000
        else: a, b = w['start'], w['end']
        for part in t.split():
            out.append({'n': norm(part), 'start': a * k, 'end': b * k})
    return out


def asr_whisper(audio):
    from faster_whisper import WhisperModel
    m = WhisperModel(os.environ.get('WHISPER_MODEL', 'small.en'), device='cpu', compute_type='int8')
    segs, _ = m.transcribe(audio, word_timestamps=True, initial_prompt='amygdala, hypothalamus')
    return [{'n': norm(p), 'start': w.start, 'end': w.end} for s in segs for w in s.words for p in w.word.split()]


def match(toks, asr):
    """Map script tokens onto ASR words (difflib); unmatched words are interpolated."""
    a = [t['n'] for t in toks]; b = [w['n'] for w in asr]
    st = [None] * len(toks); en = [None] * len(toks)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            st[blk.a + k] = asr[blk.b + k]['start']; en[blk.a + k] = asr[blk.b + k]['end']
    # interpolate holes between known neighbours
    i = 0
    while i < len(toks):
        if st[i] is None:
            j = i
            while j < len(toks) and st[j] is None: j += 1
            lo = en[i - 1] if i > 0 else 0.0
            hi = st[j] if j < len(toks) else (lo + 0.3 * (j - i))
            n = j - i
            for k in range(n):
                st[i + k] = lo + (hi - lo) * k / n; en[i + k] = lo + (hi - lo) * (k + 1) / n
            i = j
        else: i += 1
    matched = sum(1 for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks() for _ in range(blk.size))
    return st, en, matched / max(1, len(toks))


def syl(w):
    return max(1, len(re.findall(r'[aeiouy]+', w.lower().rstrip('e')))) + (1 if re.search(r'\d', w) else 0)


def silence_align(toks, audio):
    """No-model fallback: voiced segments from energy, words assigned by DP so that segment
    breaks fall on punctuation and the speaking rate stays even."""
    x, sr = load_audio(audio)
    hop = int(sr * .01)
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    db = 20 * np.log10(e)
    thr = max(np.percentile(db, 95) - 32, np.percentile(db, 10) + 6)
    v = db > thr
    segs = []; i = 0
    while i < len(v):
        if v[i]:
            j = i
            while j < len(v) and v[j]: j += 1
            segs.append([i * .01, j * .01]); i = j
        else: i += 1
    merged = []
    for s in segs:  # pauses shorter than 0.22 s are inside phrases
        if merged and s[0] - merged[-1][1] < .22: merged[-1][1] = s[1]
        else: merged.append(s)
    segs = [s for s in merged if s[1] - s[0] > .08]
    wt = np.array([syl(t['w']) + .6 for t in toks]); cw = np.concatenate([[0], np.cumsum(wt)])
    V = sum(b - a for a, b in segs); rate = V / cw[-1]
    n, m = len(toks), len(segs)
    INF = 1e18
    D = np.full((m + 1, n + 1), INF); P = np.zeros((m + 1, n + 1), int); D[0, 0] = 0
    for j in range(1, m + 1):
        dur = segs[j - 1][1] - segs[j - 1][0]
        for b in range(1, n + 1):
            pen = 0 if (b == n or toks[b - 1]['punct']) else .35
            for a in range(max(0, b - 40), b):
                if D[j - 1, a] >= INF: continue
                c = D[j - 1, a] + (dur - rate * (cw[b] - cw[a])) ** 2 / max(dur, .3) + pen
                if c < D[j, b]: D[j, b] = c; P[j, b] = a
    st = [0.0] * n; en = [0.0] * n; b = n
    for j in range(m, 0, -1):
        a = P[j, b]; s0, s1 = segs[j - 1]; tot = cw[b] - cw[a]
        for k in range(a, b):
            st[k] = s0 + (s1 - s0) * (cw[k] - cw[a]) / tot; en[k] = s0 + (s1 - s0) * (cw[k + 1] - cw[a]) / tot
        b = a
    return st, en


def resolve(cue, toks, st, en):
    end = cue.endswith('.end'); c = cue[:-4] if end else cue
    w, _, nth = c.partition('#'); nth = int(nth or 1); w = norm(w); k = 0
    for i, t in enumerate(toks):
        if t['n'] == w:
            k += 1
            if k == nth: return en[i] if end else st[i]
    sys.exit(f'cue word "{cue}" not found in VO')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('scene'); ap.add_argument('--audio'); ap.add_argument('--asr')
    ap.add_argument('--backend', choices=['auto', 'asr', 'whisper', 'silence'], default='auto')
    o = ap.parse_args()
    cfg = json.load(open(os.path.join(HERE, 'cues.json')))
    sc = cfg[o.scene]
    audio = o.audio
    if not audio:
        for cand in [f'audio/ep02v2/vo_{o.scene}.wav', f'audio/ep02v2/vo_temp_{o.scene}.wav']:
            if os.path.exists(os.path.join(ROOT, cand)): audio = cand; break
    if not audio: sys.exit('no audio found')
    apath = audio if os.path.isabs(audio) else os.path.join(ROOT, audio)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', apath],
                               capture_output=True, text=True).stdout)
    toks = tokens(script_vo(os.path.join(ROOT, cfg['script']), sc['section']))
    asr = o.asr
    if not asr and o.backend in ('auto', 'asr'):
        base = os.path.splitext(os.path.basename(apath))[0]
        for cand in [os.path.splitext(apath)[0] + '.asr.json', os.path.join(HERE, 'asr', base + '.asr.json')]:
            if os.path.exists(cand): asr = cand; break
    source = None
    if asr:
        st, en, q = match(toks, asr_from_json(asr)); source = f'asr-json:{os.path.relpath(asr, ROOT)} (match {q:.0%})'
    elif o.backend in ('auto', 'whisper'):
        try:
            st, en, q = match(toks, asr_whisper(apath)); source = f'faster-whisper (match {q:.0%})'
        except Exception as ex:
            if o.backend == 'whisper': raise
            print('whisper unavailable ->', type(ex).__name__, str(ex)[:120], '-> silence fallback')
    if source is None:
        st, en = silence_align(toks, apath); source = 'silence-detection + script text'
    lead, tail = sc['lead'], sc['tail']
    words = [{'i': i, 'w': t['w'], 'start': round(st[i] + lead, 3), 'end': round(en[i] + lead, 3)} for i, t in enumerate(toks)]
    cues = {k: round(resolve(v, toks, st, en) + lead, 3) for k, v in sc['cues'].items()}
    duration = round(max(dur, en[-1]) + lead + tail, 3)
    out = {'scene': o.scene, 'audio': os.path.relpath(apath, ROOT), 'source': source, 'vo_offset': lead,
           'audio_duration': round(dur, 3), 'duration': duration, 'cues': cues, 'words': words}
    p = os.path.join(HERE, f'timing_{o.scene}.json')
    json.dump(out, open(p, 'w'), indent=1)
    print(f'{o.scene}: {source}; {len(words)} words; scene {duration:.2f}s -> {os.path.relpath(p, ROOT)}')


if __name__ == '__main__':
    main()

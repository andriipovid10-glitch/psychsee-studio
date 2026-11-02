"""short01 sound: procedural SFX + drone bed timed to timing.json cues (helpers copied from ep02v2/sfx.py)."""
import json, os, sys, wave
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sr = 48000
TM = json.load(open(os.path.join(HERE, 'timing.json'))); c = TM['cues']; DUR = TM['duration']
n = int(sr * DUR) + sr
fx = np.zeros((n, 2)); bed = np.zeros((n, 2))
R = np.random.RandomState(7)

def add(buf, t0, w, pan=0.0, amp=1.0):
    i0 = int(t0 * sr)
    if i0 >= n: return
    if i0 < 0: w = w[-i0:]; i0 = 0
    e = min(n, i0 + len(w)); w = w[:e - i0] * amp
    buf[i0:e, 0] += w * np.sqrt(.5 * (1 - pan)) * 1.414; buf[i0:e, 1] += w * np.sqrt(.5 * (1 + pan)) * 1.414


def band(w, lo, hi):
    F = np.fft.rfft(w); f = np.fft.rfftfreq(len(w), 1 / sr); F[(f < lo) | (f > hi)] = 0; return np.fft.irfft(F, len(w))


def env(L, a, d):
    x = np.arange(int(L * sr)) / sr; return np.minimum(1, x / max(a, 1e-4)) * np.exp(-np.maximum(0, x - a) * d)


# ---- voices (thump / click / whoosh from reference-ep00, retimed)
def thump(t0, amp, f=55, L=.25, buf=fx):
    x = np.arange(int(L * sr)) / sr
    add(buf, t0, np.sin(2 * np.pi * f * x * (1 - .3 * x / L)) * np.exp(-x * 22), amp=amp)


def heartbeat(t0, amp, bpm=70):
    thump(t0, amp, 52, .3); thump(t0 + .2 * 60 / max(bpm, 60), amp * .6, 46, .25)


def click(t0, amp, f=2400, pan=0.0):
    x = np.arange(int(.05 * sr)) / sr
    add(fx, t0, np.sin(2 * np.pi * f * x) * np.exp(-x * 90), pan, amp)


def whoosh(tc, width, amp, lo=200, hi=3000, pan=0.0):
    L = width * 6; x = np.arange(int(L * sr)) / sr - L / 2
    w = band(R.randn(len(x)), lo, hi); w /= np.abs(w).max() + 1e-9
    add(fx, tc - L / 2, w * np.exp(-(x / width) ** 2), pan, amp)


def riser(t0, t1, amp, lo=300, hi=6000):
    L = t1 - t0; x = np.arange(int(L * sr)) / sr
    w = band(R.randn(len(x)), lo, hi); w /= np.abs(w).max() + 1e-9
    k = x / L; add(fx, t0, w * k ** 2.5 * (1 - np.exp(-(L - x) * 40)), amp=amp)
    add(fx, t0, np.sin(2 * np.pi * np.cumsum(200 + 900 * k ** 2) / sr) * k ** 3 * .4, amp=amp)


def zap(t0, amp, L=.35, f0=1800, f1=300, pan=0.0):
    """electric discharge: falling buzzy tone + crackle"""
    x = np.arange(int(L * sr)) / sr; f = f0 * (f1 / f0) ** (x / L)
    tone = np.sign(np.sin(2 * np.pi * np.cumsum(f) / sr)) * .35 + np.sin(2 * np.pi * np.cumsum(f * 2.01) / sr) * .3
    crack = band(R.randn(len(x)), 2000, 9000) * (R.rand(len(x)) < .08)
    add(fx, t0, (tone + crack * 2) * np.exp(-x * 9) * np.minimum(1, x / .004), pan, amp)


def ping(t0, amp, f=1320, L=1.2, pan=0.0):
    """alarm ping: two partials, bell-ish decay"""
    x = np.arange(int(L * sr)) / sr
    w = (np.sin(2 * np.pi * f * x) + .5 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 6)) * np.exp(-x * 3.2) * np.minimum(1, x / .002)
    add(fx, t0, w, pan, amp)


def tick(t0, amp, hi=True):
    x = np.arange(int(.03 * sr)) / sr
    w = band(R.randn(len(x)), 2500 if hi else 1200, 8000) * np.exp(-x * 260) + np.sin(2 * np.pi * (3200 if hi else 2100) * x) * np.exp(-x * 200) * .5
    add(fx, t0, w, .25, amp)


def tapestop(t0, amp, L=.9):
    x = np.arange(int(L * sr)) / sr; f = 220 * (1 - x / L) ** 2 + 30
    add(fx, t0, np.sin(2 * np.pi * np.cumsum(f) / sr) * (1 - x / L) * .8 + band(R.randn(len(x)), 80, 600) * (1 - x / L) ** 2 * .3, amp=amp)


def ring(t0, amp, L=2.5, f=3900):
    """tinnitus-like ring after the freeze"""
    x = np.arange(int(L * sr)) / sr
    add(fx, t0, np.sin(2 * np.pi * f * x) * np.exp(-x * 1.6) * np.minimum(1, x / .05), amp=amp)


def carpass(tc, amp, L=4.0):
    x = np.arange(int(L * sr)) / sr - L / 2
    eng = band(R.randn(len(x)), 60, 900) + np.sin(2 * np.pi * np.cumsum(70 - 18 * np.tanh(x * 2)) / sr) * .6
    a = 1 / (1 + (x * 2.2) ** 2); pan = np.tanh(x * 1.5)
    i0 = int((tc - L / 2) * sr)
    for ch, g in ((0, np.sqrt(.5 * (1 - pan))), (1, np.sqrt(.5 * (1 + pan)))):
        seg = eng * a * g * 1.4 * amp; e = min(n, i0 + len(seg)); fx[i0:e, ch] += seg[:e - i0]


def blips(t0, t1, amp):
    t = t0
    while t < t1: click(t, amp, 3600 + 500 * R.rand(), pan=R.rand() - .5); t += .11 + .1 * R.rand()


def drone(buf, t0, t1, amp, f=41.2, fade=1.5):
    i0, i1 = int(t0 * sr), int(t1 * sr); x = np.arange(i1 - i0) / sr
    m = .6 + .4 * np.sin(2 * np.pi * .07 * x)
    w = (np.sin(2 * np.pi * f * x) + .55 * np.sin(2 * np.pi * f * 1.5 * x + .3) * m + .35 * np.sin(2 * np.pi * f * 2.01 * x)
         + .25 * np.sin(2 * np.pi * f * 3 * x) * (.5 + .5 * np.sin(2 * np.pi * .05 * x)))
    hiss = band(R.randn(len(x)), 120, 700) * .08 * m
    e = np.minimum(1, x / fade) * np.minimum(1, (x[-1] - x) / fade)
    buf[i0:i1, 0] += (w + hiss) * e * amp; buf[i0:i1, 1] += (w * .97 + np.roll(hiss, 900)) * e * amp


# ================================================================== s00 (first 30 s) — every hit sits on a VO cue
# ---- cues
drone(bed, 0, c['but'] - .1, .08, 55.0, .6)          # warm dream bed
drone(bed, c['fake'] - .3, DUR - .3, .08, 41.2, 1.0)  # after the twist
thump(.05, .7, 50, .45); whoosh(.25, .5, .35)
for k in ('reason', 'dont'): thump(c[k] - .03, .45, 60, .3)
whoosh(c['students'] - .15, .35, .3); ping(c['grade'] - .1, .25, 1568)
thump(c['worse'] - .02, .8, 45, .45); zap(c['worse'], .3)
whoosh(c['when'] - .15, .35, .25)
tapestop(c['drops'] - .2, .45)
thump(c['but'] - .02, 1.0, 38, .6); tick(c['but'] - .02, .4)
riser(c['study'] - .2, c['pct'] - .05, .25)
for i in range(8): tick(c['pct'] - .9 + i * .12, .18)
thump(c['pct'] + .2, .8, 48, .4); ping(c['pct'] + .2, .2, 1320)
click(c['weights'] - .02, .3)
whoosh(c['difference'] - .15, .35, .3)
for kw in ('work', 'trophy', 'stop', 'reps', 'practice'): thump(c[kw] - .03, .45, 55, .3); click(c[kw], .15, 1600)
tapestop(c['trophy'] + .1, .25)
whoosh(c['follow'] - .15, .3, .35); thump(c['follow'] - .02, .7, 45, .4); ping(c['follow'] + .05, .2, 1760)

def write(p, b):
    b = b / max(1e-9, np.abs(b).max()) * .89
    with wave.open(p, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((b[:int(DUR * sr)] * 32767).astype(np.int16).tobytes())
    print('wrote', p, f'{DUR:.2f}s')
write(sys.argv[1], fx); write(sys.argv[2], bed)

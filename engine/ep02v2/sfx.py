"""Procedural sound design for EP02 v2 (first 30 s) (no third-party audio, no copyright risk).
Builds ONE stereo track for all scenes in ORDER, every hit placed on a cue word from timing_sNN.json,
so it re-syncs automatically when the VO changes. Synth voices adapted from engine/reference-ep00/sfx.py
(thump, click, whoosh) plus zap, alarm ping, clock tick, tape-stop, car pass and a dark drone bed.

usage: python3 engine/ep02/sfx.py out_sfx.wav out_bed.wav
  out_sfx.wav = hits/whooshes/heartbeats/ticks, out_bed.wav = drone/music bed (mixed quieter, ducked under VO)
"""
import json, os, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = os.environ.get('SCENES', 's00').split()
sr = 48000
T = {s: json.load(open(os.path.join(HERE, f'timing_{s}.json'))) for s in ORDER}
offs, o = {}, 0.0
for s in ORDER: offs[s] = o; o += T[s]['duration']
DUR = o
n = int(sr * DUR) + sr
fx = np.zeros((n, 2)); bed = np.zeros((n, 2))
R = np.random.RandomState(3)


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
c = {k: v + offs['s00'] for k, v in T['s00']['cues'].items()}; E0 = T['s00']['duration']


def room(t0, t1, amp, lo, hi):
    """crowd / room tone: band-limited noise with slow swells"""
    i0, i1 = int(t0 * sr), int(t1 * sr); x = np.arange(i1 - i0) / sr
    w = band(R.randn(len(x)), lo, hi); w /= np.abs(w).max() + 1e-9
    e = np.minimum(1, x / .08) * np.minimum(1, (x[-1] - x) / .08) * (.7 + .3 * np.sin(2 * np.pi * .9 * x))
    fx[i0:i1, 0] += w * e * amp; fx[i0:i1, 1] += np.roll(w, 700) * e * amp


# HOOK: tension bed, a bass hit + whoosh on every location cut, a bit of room tone per place
drone(bed, .25, c['quiet'], .07, 41.2, 1.2)
thump(c['fight'], .45, 60, .3)
for k, (lo, hi) in [('school', (300, 2500)), ('bar', (150, 1800)), ('street', (80, 900))]:
    t = c[k] - .04
    thump(t, 1.0, 45, .55); thump(t + .01, .45, 95, .15); whoosh(t - .05, .06, .35, 600, 7000); click(t, .25, 1200)
room(c['school'] - .04, c['bar'] - .04, .05, 300, 2500)
room(c['bar'] - .04, c['street'] - .04, .06, 150, 1800)
room(c['street'] - .04, c['panic'], .05, 80, 900)
# THE FEELING: heartbeat builds 75 -> 150 bpm, each keyword is a hit
t, k = c['remember2'], 0
while t < c['quiet']:
    f = (t - c['remember2']) / (c['quiet'] - c['remember2']); bpm = 75 + 75 * f
    heartbeat(t, .55 + .45 * f, bpm); t += 60 / bpm
for w in ['panic', 'heart', 'slamming', 'hands', 'shaking', 'mouth', 'dry']:
    thump(c[w], .75, 52, .3); click(c[w], .22, 2000); whoosh(c[w] - .03, .04, .18, 1200, 8000)
whoosh(c['panic'] - .05, .1, .3, 200, 3000)
for i in range(18): click(c['hands'] + .05 + i * .07, .05, 3000 + 300 * (i % 3), pan=.4 * np.sin(i))   # rattle
# "everything went quiet": the world drops out, only a deep slow heart is left
t = c['quiet']
while t < c['heres'] - .2: heartbeat(t, 1.0, 58); t += 60 / 58
ring(c['quiet'] + .1, .03, 3.0, 5200)
tapestop(c['slow'] - .1, .55, 1.2); whoosh(c['slow'] + .5, .45, .3, 80, 900)
# THE TWIST: freeze impact, a click per icon, a hit on the lie, scanner ticks
thump(c['heres'] - .12, .9, 40, .6); whoosh(c['heres'] - .14, .05, .45, 2000, 9000)
for i in range(6): click(c['heres'] + i * .14, .3, 2200 + i * 160, pan=-.5 + .2 * i)
thump(c['didnt'], .45, 55, .25)
for i in range(6): click(c['body'] + i * .12 + .4, .1, 3400, pan=-.5 + .2 * i)
drone(bed, c['heres'], c['this'], .05, 36.7, .6)
thump(c['lie'], 1.0, 38, .7); ping(c['lie'], .25, 880, 1.6); click(c['lie'], .3, 900)
t, st = c['lie'], 0
while t < c['this'] - .1: click(t, .12, 3800 if st % 2 else 3200); t += .13 if t < c['stay'] else .26; st += 1
# TITLE: dive in, the clock appears and ticks
riser(c['this'], c['inside'] + .02, .4)
thump(c['inside'] + .05, 1.0, 42, .6); whoosh(c['inside'] + .03, .05, .4, 1500, 9000)
t, k = c['inside'] + .05, 0
while t < E0 - .3: tick(t, .2 if k % 2 == 0 else .13, k % 2 == 0); t += .5; k += 1
for w in ['ten', 'second', 'second2']: thump(c[w], .5, 60, .2)
drone(bed, c['inside'], E0, .06, 41.2, .8)
thump(E0 - .35, .6, 40, .5)

# ================================================================== write
def write(p, b):
    b = b / max(1e-9, np.abs(b).max()) * .89
    with wave.open(p, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((b[:int(DUR * sr)] * 32767).astype(np.int16).tobytes())
    print('wrote', p, f'{DUR:.2f}s')


write(sys.argv[1] if len(sys.argv) > 1 else 'sfx.wav', fx)
write(sys.argv[2] if len(sys.argv) > 2 else 'bed.wav', bed)

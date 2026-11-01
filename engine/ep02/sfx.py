"""Procedural sound design for EP02 (no third-party audio, no copyright risk).
Builds ONE stereo track for all scenes in ORDER, every hit placed on a cue word from timing_sNN.json,
so it re-syncs automatically when the VO changes. Synth voices adapted from engine/reference-ep00/sfx.py
(thump, click, whoosh) plus zap, alarm ping, clock tick, tape-stop, car pass and a dark drone bed.

usage: python3 engine/ep02/sfx.py out_sfx.wav out_bed.wav
  out_sfx.wav = hits/whooshes/heartbeats/ticks, out_bed.wav = drone/music bed (mixed quieter, ducked under VO)
"""
import json, os, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ['s00', 's01']
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


# ================================================================== s00
c = {k: v + offs['s00'] for k, v in T['s00']['cues'].items()}; S0, E0 = offs['s00'], offs['s00'] + T['s00']['duration']
FZ = c['shove'] + .32
drone(bed, S0 + .45, FZ, .05, 55, .3)                      # room tension before the shove
thump(c['someone'] - .3, .25, 70, .15); whoosh(c['shove'] - .12, .09, .35, 300, 2500)
thump(c['shove'], 1.0, 48, .5); thump(c['shove'] + .02, .5, 90, .15); click(c['shove'], .3, 900)
whoosh(FZ - .02, .05, .5, 1500, 9000); thump(FZ, .5, 40, .4); ring(FZ + .05, .05)
heartbeat(FZ + .85, 1.0, 60)                                # one deep heartbeat, then silence
tt = FZ + 1.0; k = 0
while tt < E0 + T['s01']['duration']:                       # ticking clock through the whole minute
    tick(tt, .13 if k % 2 == 0 else .09, k % 2 == 0); tt += .5; k += 1
drone(bed, FZ + 1.4, E0 + .2, .085, 41.2, 2.0)
for i in range(7): click(c['seven'] - .1 + i * .11, .22, 2600 + i * 180, pan=-.3 + .1 * i)
thump(c['decisions'] - .1, .55, 60, .2); whoosh(c['decisions'] - .1, .08, .12, 400, 4000)
thump(c['permission'] - .05, .85, 42, .45); click(c['permission'] - .05, .2, 1600)
whoosh(c['hearing'] - .3, .3, .25, 150, 1600, -.4)
# hearing: a muffled sweep (high band dying away)
L = 1.4; x = np.arange(int(L * sr)) / sr; w = band(R.randn(len(x)), 300, 3000) * np.exp(-x * 3) * .3; add(fx, c['hearing'] + .1, w)
whoosh(c['vision'] - .25, .35, .3, 200, 2500, .3); thump(c['vision'] + .3, .3, 70, .2)
zap(c['pain'] - .1, .35, .3, 2400, 600); click(c['pain'] + .45, .3, 700); click(c['pain'] + .55, .2, 500)
for cu in ['hearing', 'vision', 'pain']: click(c[cu] - .1, .18, 3000)
whoosh(c['people'] - .1, .7, .25, 150, 1800)
tapestop(c['slow'] - .05, .45)
click(c['secbysec'], .3, 2200); click(c['secbysec2'], .3, 2200)
whoosh(c['stay'] + .2, .5, .2, 300, 3000); click(c['eight'], .35, 2600); thump(c['eight'], .25, 80, .15)
click(c['everyone'] - .05, .15, 3200)
thump(c['isnt'], .9, 45, .4); click(c['isnt'], .35, 1200); whoosh(c['isnt'] + .02, .06, .3, 1000, 7000)
riser(c['happening'] - .4, E0, .35, 400, 8000)

# ================================================================== s01
c = {k: v + offs['s01'] for k, v in T['s01']['cues'].items()}; S1, E1 = offs['s01'], offs['s01'] + T['s01']['duration']
whoosh(S1 + .15, .5, .6, 60, 900); whoosh(S1 + 1.0, 1.0, .35, 100, 1400)   # whoosh into the skull
L = c['see'] - S1; x = np.arange(int(L * sr)) / sr; add(fx, S1, band(R.randn(len(x)), 80, 500) * np.minimum(1, x / .3) * np.exp(-x * .5) * .5)
whoosh(c['see'] - .1, .6, .3, 150, 2000)
drone(bed, S1, E1, .085, 41.2, 1.0)
ping(c['light'] + .05, .25, 2640, .9); whoosh(c['light'] + .1, .15, .15, 3000, 10000)
zap(c['eyes'] + .25, .25, .25, 3000, 1500, .3); zap(c['signal'] + .3, .25, .25, 2600, 1200, .1)
zap(c['races'] - .1, .45, .4, 2200, 400, -.1)
ping(c['amyg1'], .5, 1320, 1.4); ping(c['amyg1'] + .25, .35, 990, 1.2); thump(c['amyg1'], .5, 60, .25)
ping(c['alarm'], .3, 1320, 1.0)
whoosh(c['deep'], .5, .25, 150, 1600)
whoosh(c['amyg2'] - .3, .45, .3, 150, 1800, .4)
blips(c['amyg2'] - .1, c['fires'] - .5, .05)
whoosh(c['fires'] - .3, .3, .25, 200, 2000)
zap(c['fires'] + .1, .4, .5, 2000, 500); zap(c['hypo'] - .02, .75, .45, 3200, 300); ping(c['hypo'] + .05, .45, 1760, 1.3); thump(c['hypo'], .5, 55, .25)
whoosh(c['wiring'] - .3, .45, .25, 200, 2500)
zap(c['cascade'], .55, .9, 1600, 120); thump(c['cascade'] + .5, .4, 45, .4)
whoosh(c['visual'] - .3, .4, .25, 200, 2500, -.4); blips(c['visual'] + .2, c['thatswhy'] - .5, .05)
whoosh(c['thatswhy'] - .35, .15, .3, 300, 5000)
carpass(c['jump'] + 1.1, .55, 4.5)
whoosh(c['jump'] + .05, .12, .4, 300, 3000); thump(c['jump'] + .55, .45, 70, .15)
click(c['car2'] - .05, .25, 1800)
whoosh(c['yourbody'] - .35, .15, .3, 300, 5000)
tb = c['yourbody'] - .2
while tb < E1 - .3:
    heartbeat(tb, .55 + .25 * min(1, (tb - c['yourbody']) / 4), 115); tb += 60 / 115
for cu in ['reacting', 'threat']: click(c[cu], .12, 2800)
riser(c['driving'] - .2, c['passenger'] - .05, .25, 200, 5000)
thump(c['passenger'] - .02, 1.0, 40, .7); click(c['passenger'] - .02, .3, 1400); whoosh(c['passenger'], .08, .3, 800, 8000)

# ================================================================== write
def write(p, b):
    b = b / max(1e-9, np.abs(b).max()) * .89
    with wave.open(p, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((b[:int(DUR * sr)] * 32767).astype(np.int16).tobytes())
    print('wrote', p, f'{DUR:.2f}s')


write(sys.argv[1] if len(sys.argv) > 1 else 'sfx.wav', fx)
write(sys.argv[2] if len(sys.argv) > 2 else 'bed.wav', bed)

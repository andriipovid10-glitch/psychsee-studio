"""Procedural sound design for the reference test (ep00).
Synthesises heartbeat thumps, UI clicks, whooshes, drones and impacts with numpy,
so no third-party audio is needed (no copyright risk). Copy and retime for new episodes.

usage: python3 sfx.py out.wav
"""
import sys, wave
import numpy as np

sr = 48000
dur = 11.0
n = int(sr * dur)
a = np.zeros(n)
tt = np.arange(n) / sr

ease = lambda t: 4 * t**3 if t < .5 else 1 - (-2 * t + 2) ** 3 / 2
seg = lambda t, lo, hi: min(1, max(0, (t - lo) / (hi - lo)))
bpm = lambda t: 72 + (128 - 72) * ease(seg(t, 6.2, 8.4))


def add(t0, w):
    i0 = int(t0 * sr); e = min(n, i0 + len(w)); a[i0:e] += w[:e - i0]


def thump(t0, amp, f=55, L=.2):
    """Low body hit: heartbeat, impacts."""
    x = np.arange(int(L * sr)) / sr
    add(t0, np.sin(2 * np.pi * f * x * (1 - .3 * x / L)) * np.exp(-x * 26) * amp)


def click(t0, amp, f=2400):
    """Short UI tick: words, cards, counters."""
    x = np.arange(int(.05 * sr)) / sr
    add(t0, np.sin(2 * np.pi * f * x) * np.exp(-x * 90) * amp)


def whoosh(tc, width, amp, lo=200, hi=3000, seed=1):
    """Band-passed noise swell: camera moves, transitions."""
    r = np.random.RandomState(seed).randn(n)
    F = np.fft.rfft(r); f = np.fft.rfftfreq(n, 1 / sr); F[(f < lo) | (f > hi)] = 0
    w = np.fft.irfft(F, n); w /= np.abs(w).max()
    a[:] += w * np.exp(-((tt - tc) / width) ** 2) * amp


# hook: words slam in
thump(.18, .9, 45); click(.18, .25); thump(.4, .9, 42); click(.4, .25)
whoosh(.5, .35, .12, seed=2)
# speech word pops
for t0 in [1.8, 1.89, 1.98, 2.07, 2.16]: click(t0, .12, 1800)
for t0 in [2.8, 2.96]: click(t0, .15, 1500)
thump(3.15, .35, 70, .12)
# camera dive whoosh
whoosh(4.9, .55, .2, 100, 1800, 3)
# heartbeat (lub-dub), accelerating
ph = np.cumsum([bpm(i / sr) / 60 * (48 / sr) for i in range(0, n, 48)])
for k in range(1, len(ph)):
    if int(ph[k]) > int(ph[k - 1]):
        tb = k * 48 / sr
        if tb < 5.0 or tb > 8.95: continue
        v = .35 + .65 * seg(tb, 5, 8.4)
        thump(tb, v); thump(tb + .2 * 60 / bpm(tb), v * .6, 48)
# UI cards
for t0 in [6.0, 6.35, 6.7]: click(t0, .18, 3000)
# tension riser + sub drone
a += .05 * np.sin(2 * np.pi * (180 + 260 * np.clip((tt - 6) / 2.9, 0, 1)) * tt) * np.clip((tt - 6) / 2.5, 0, 1) * (tt < 8.95)
a += .05 * np.sin(2 * np.pi * 41 * tt) * np.clip((tt - 4.5) / 1.5, 0, 1) * (tt < 8.95)
# title impact
thump(9.0, 1.0, 38, .6); whoosh(9.05, .25, .15, 300, 4000, 4); thump(9.18, .5, 60, .2)

a = np.clip(a / np.abs(a).max() * .9, -1, 1)
out = sys.argv[1] if len(sys.argv) > 1 else 'sfx.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((np.stack([a, a], 1) * 32767).astype(np.int16).tobytes())
print('wrote', out)

"""Cut vertical Shorts (1080x1920) out of the finished EP02 master.

usage: python3 engine/ep02v2/shorts.py [MASTER] [OUTDIR] [only_name]
Layout: blurred full-bleed background, the 16:9 video in the middle, a "full video on the channel" pill + hook title
on top, word-group captions below the video (kept above the Shorts UI at the bottom). No corner labels.
"""
import json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ORDER = ['s00', 's01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10']
T = {s: json.load(open(os.path.join(HERE, f'timing_{s}.json'))) for s in ORDER}
OFF, o = {}, 0.0
for s in ORDER: OFF[s] = o; o += T[s]['duration']
MASTER = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else os.path.join(ROOT, 'renders/ep02v2/hd3/ep02v2_1080p_v3.mp4')
OUT = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else os.path.join(ROOT, 'renders/ep02v2/shorts')
ONLY = sys.argv[3] if len(sys.argv) > 3 else None

# name, scene, first word to keep (None = scene start), hook title (two lines max, {r} ... {w} = red)
SHORTS = [
    ('short1_pulse', 's02', 'adrenaline', 'CHECK YOUR PULSE\\N{r}RIGHT NOW{w}'),
    ('short2_tunnel', 's04', 'quick', 'STARE AT THE\\N{r}RED DOT{w}'),
    ('short3_pain', 's06', 'the', 'WHY FIGHTERS DON\'T FEEL\\NA {r}BROKEN HAND{w}'),
    ('short4_slowmo', 's07', 'in', 'TIME DOESN\'T {r}SLOW DOWN{w}\\NIN A FIGHT'),
    ('short5_control', 's09', 'one', 'HOW TO STAY {r}IN CONTROL{w}\\NIN A FIGHT'),
]
VY, VH = 600, 608   # video band

norm = lambda w: re.sub(r"[^a-z0-9%']", '', w.lower())
def ts(x): h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60; return f'{h}:{m:02d}:{s:05.2f}'

HEAD = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Pill,Inter,40,&H00FFFFFF,&H00FFFFFF,&H004033FF,&H004033FF,1,0,0,0,100,100,2,0,3,18,0,8,0,0,150,1
Style: Handle,DejaVu Sans Mono,30,&H00B3978A,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,4,0,1,0,0,8,0,0,232,1
Style: Title,Inter,84,&H00FAF2EE,&H00FFFFFF,&H00000000,&HA0000000,1,0,0,0,100,100,-2,0,1,0,6,5,40,40,0,1
Style: Cap,Inter,78,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,6,3,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
RED, WHITE = r'{\c&H4033FF&}', r'{\c&HFAF2EE&}'


def build(name, sc, first, title):
    W = T[sc]['words']; i0 = 0
    if first:
        i0 = next(i for i, w in enumerate(W) if norm(w['w']) == first)
    t0 = OFF[sc] + (max(0, W[i0]['start'] - .12) if first else 0)
    t1 = OFF[sc] + T[sc]['duration']
    D = t1 - t0
    ev = []
    ev.append(f"Dialogue: 0,{ts(0)},{ts(D)},Pill,,0,0,0,,{{\\fad(200,0)}} FULL VIDEO ON MY CHANNEL ")
    ev.append(f"Dialogue: 0,{ts(0)},{ts(D)},Handle,,0,0,0,,@psychsee")
    ev.append(f"Dialogue: 0,{ts(0)},{ts(D)},Title,,0,0,0,,{{\\pos(540,430)\\fad(150,0)}}" + title.replace('{r}', RED).replace('{w}', WHITE))
    # captions: groups of <=3 words, break after punctuation
    grp = []
    for w in W[i0:]:
        grp.append(w)
        if len(grp) == 3 or re.search(r'[.,?!:;—]$', w['w']):
            ev.append(cap(grp, t0)); grp = []
    if grp: ev.append(cap(grp, t0))
    ass = os.path.join(OUT, name + '.ass'); open(ass, 'w').write(HEAD + '\n'.join(ev) + '\n')
    out = os.path.join(OUT, name + '.mp4'); tmp = out.replace('.mp4', '.part.mp4')
    fc = (f"[0:v]split=2[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=28:2,eq=brightness=-0.32:saturation=0.75[bg];"
          f"[b]scale=1080:{VH}[fg];[bg][fg]overlay=0:{VY},ass={ass}:fontsdir=/usr/share/fonts[v];[0:a]afade=t=out:st={D - .4:.2f}:d=0.4[au]")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{t0:.3f}', '-t', f'{D:.3f}', '-i', MASTER, '-filter_complex', fc,
                    '-map', '[v]', '-map', '[au]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-maxrate', '12M', '-bufsize', '24M',
                    '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, out); print('wrote', out, f'{D:.1f}s')


def cap(g, t0):
    a = g[0]['start'] + OFF_CUR[0] - t0; b = g[-1]['end'] + OFF_CUR[0] - t0 + .08
    txt = ' '.join(w['w'] for w in g).upper()
    txt = re.sub(r'(\d[\d,.%–-]*%?)', lambda m: RED + m.group(1) + '{\\c&HFFFFFF&}', txt)
    return f"Dialogue: 1,{ts(max(0, a))},{ts(b)},Cap,,0,0,0,,{{\\pos(540,1330)\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}}" + txt


OFF_CUR = [0]
os.makedirs(OUT, exist_ok=True)
for nm, sc, first, title in SHORTS:
    if ONLY and ONLY != nm: continue
    OFF_CUR[0] = OFF[sc]; build(nm, sc, first, title)

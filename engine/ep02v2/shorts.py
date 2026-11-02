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

# the whole episode as a numbered series, in order: name, scenes, hook title ({r}..{w} = red)
SHORTS = [
    ('part1', ['s00', 's01'], 'THE FIRST {r}10 SECONDS{w}\\NOF A FIGHT'),
    ('part2', ['s02', 's03'], 'YOUR BODY\\NGOES {r}ALL-IN{w}'),
    ('part3', ['s04', 's05'], 'YOUR EYES AND EARS\\N{r}SHUT DOWN{w}'),
    ('part4', ['s06', 's07'], 'PAIN OFF.\\NTIME {r}LIES.{w}'),
    ('part5', ['s08', 's09', 's10'], 'HOW TO STAY\\N{r}IN CONTROL{w}'),
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
Style: Part,Inter,56,&H004033FF,&H00FFFFFF,&H00000000,&HA0000000,1,0,0,0,100,100,6,0,1,0,4,5,40,40,0,1
Style: Next,Inter,50,&H00FAF2EE,&H00FFFFFF,&H00000000,&HA0000000,1,0,0,0,100,100,2,0,1,0,4,5,40,40,0,1
Style: Title,Inter,80,&H00FAF2EE,&H00FFFFFF,&H00000000,&HA0000000,1,0,0,0,100,100,-2,0,1,0,6,5,40,40,0,1
Style: Cap,Inter,78,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,6,3,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
RED, WHITE = r'{\c&H4033FF&}', r'{\c&HFAF2EE&}'


def build(name, scenes, title, part, nparts):
    t0 = OFF[scenes[0]]; t1 = OFF[scenes[-1]] + T[scenes[-1]]['duration']; D = t1 - t0
    W = [dict(w, start=w['start'] + OFF[sc] - t0, end=w['end'] + OFF[sc] - t0) for sc in scenes for w in T[sc]['words']]
    ev = []
    ev.append(f"Dialogue: 0,{ts(0)},{ts(D)},Pill,,0,0,0,,{{\\fad(200,0)}} FULL VIDEO ON MY CHANNEL ")
    ev.append(f"Dialogue: 0,{ts(0)},{ts(D)},Handle,,0,0,0,,@psychsee")
    ev.append(f"Dialogue: 0,{ts(0)},{ts(D)},Part,,0,0,0,,{{\\pos(540,330)\\fad(150,0)}}PART {part}/{nparts}")
    ev.append(f"Dialogue: 0,{ts(0)},{ts(D)},Title,,0,0,0,,{{\\pos(540,470)\\fad(150,0)}}" + title.replace('{r}', RED).replace('{w}', WHITE))
    if part < nparts:
        ev.append(f"Dialogue: 2,{ts(D - 3)},{ts(D)},Next,,0,0,0,,{{\\pos(540,1520)\\fad(200,0)}}PART {part + 1} {RED}→ NEXT SHORT")
    grp = []
    for w in W:
        grp.append(w)
        if len(grp) == 3 or re.search(r'[.,?!:;—…]$', w['w']):
            ev.append(cap(grp)); grp = []
    if grp: ev.append(cap(grp))
    ass = os.path.join(OUT, name + '.ass'); open(ass, 'w').write(HEAD + '\n'.join(ev) + '\n')
    out = os.path.join(OUT, name + '.mp4'); tmp = out.replace('.mp4', '.part.mp4')
    fc = (f"[0:v]split=2[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=28:2,eq=brightness=-0.32:saturation=0.75[bg];"
          f"[b]scale=1080:{VH}[fg];[bg][fg]overlay=0:{VY},ass={ass}:fontsdir=/usr/share/fonts[v];[0:a]afade=t=out:st={D - .4:.2f}:d=0.4[au]")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{t0:.3f}', '-t', f'{D:.3f}', '-i', MASTER, '-filter_complex', fc,
                    '-map', '[v]', '-map', '[au]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-maxrate', '12M', '-bufsize', '24M',
                    '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, out); print('wrote', out, f'{D:.1f}s')


def cap(g):
    a = g[0]['start']; b = g[-1]['end'] + .08
    txt = ' '.join(w['w'] for w in g).upper()
    txt = re.sub(r'(\d[\d,.%–-]*%?)', lambda m: RED + m.group(1) + '{\\c&HFFFFFF&}', txt)
    return f"Dialogue: 1,{ts(max(0, a))},{ts(b)},Cap,,0,0,0,,{{\\pos(540,1330)\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}}" + txt


os.makedirs(OUT, exist_ok=True)
for i, (nm, scenes, title) in enumerate(SHORTS):
    if ONLY and ONLY != nm: continue
    build(nm, scenes, title, i + 1, len(SHORTS))

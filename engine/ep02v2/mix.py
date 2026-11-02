"""Concat rendered scenes + mix audio for EP02 (per CLAUDE.md).
VO: high-pass 80 Hz, light compression, loudnorm -16 LUFS (two-pass). SFX under the VO, drone bed ducked under the VO.

usage: python3 engine/ep02v2/mix.py renders/ep02v2/ep02v2_first30s_draft.mp4
Reads timing_sNN.json for each scene (which VO file, lead, scene duration) and renders/ep02v2/sceneNN.mp4.
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ORDER = os.environ.get('SCENES', 's00').split()
RD = os.environ.get('RD') or os.path.join(ROOT, 'renders', 'ep02v2'); os.makedirs(RD, exist_ok=True)
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RD, 'ep02v2_first30s_draft.mp4')
run = lambda *a: subprocess.run(list(a), check=True, capture_output=True, text=True)
T = {s: json.load(open(os.path.join(HERE, f'timing_{s}.json'))) for s in ORDER}

# 1. video concat (same encoder settings for every scene -> stream copy)
lst = os.path.join(RD, 'concat.txt')
open(lst, 'w').write(''.join(f"file '{os.path.join(RD, 'scene' + s[1:] + '.mp4')}'\n" for s in ORDER))
video = os.path.join(RD, 'video_concat.mp4')
run('ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', video)

# 2. VO track: each scene's VO delayed by its lead and padded to the scene length, then joined
parts = []
for s in ORDER:
    t = T[s]; p = os.path.join(RD, f'vo_{s}_placed.wav')
    run('ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(ROOT, t['audio']), '-af',
        f"aformat=sample_rates=48000:channel_layouts=mono,adelay={int(t['vo_offset'] * 1000)}:all=1,apad=whole_dur={t['duration']},atrim=0:{t['duration']}",
        '-ar', '48000', p)
    parts.append(p)
vo_raw = os.path.join(RD, 'vo_raw.wav')
run('ffmpeg', '-y', '-loglevel', 'error', *sum([['-i', p] for p in parts], []), '-filter_complex',
    ''.join(f'[{i}]' for i in range(len(parts))) + f'concat=n={len(parts)}:v=0:a=1', vo_raw)
chain = 'highpass=f=80,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=150:makeup=1.5'
m = run('ffmpeg', '-hide_banner', '-i', vo_raw, '-af', chain + ',loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-').stderr
j = json.loads(re.findall(r'\{[^{}]*\}', m)[-1])
vo = os.path.join(RD, 'vo_proc.wav')
run('ffmpeg', '-y', '-loglevel', 'error', '-i', vo_raw, '-af',
    chain + f",loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true",
    '-ar', '48000', '-ac', '2', vo)

# 3. SFX + bed
sfx, bed = os.path.join(RD, 'sfx.wav'), os.path.join(RD, 'bed.wav')
run(sys.executable, os.path.join(HERE, 'sfx.py'), sfx, bed)

# 4. mix: SFX ~ -15 LU under, bed ~ -20 dB and ducked by the VO; limiter
mix = os.path.join(RD, 'mix.wav')
run('ffmpeg', '-y', '-loglevel', 'error', '-i', vo, '-i', sfx, '-i', bed, '-filter_complex',
    '[0]asplit=2[v][sc];'
    '[1]volume=-4dB[s];'
    '[2]volume=-15dB[b0];[b0][sc]sidechaincompress=threshold=0.03:ratio=4:attack=30:release=400[b];'
    '[v][s][b]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.85:level=false[m]',
    '-map', '[m]', '-ar', '48000', mix)
tmp = out.replace('.mp4', '.part.mp4')
run('ffmpeg', '-y', '-loglevel', 'error', '-i', video, '-i', mix, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', tmp)
os.replace(tmp, out)
lufs = run('ffmpeg', '-hide_banner', '-i', out, '-af', 'ebur128', '-f', 'null', '-').stderr
I = re.findall(r'I:\s+(-?[\d.]+) LUFS', lufs)
print('wrote', os.path.relpath(out, ROOT), '| integrated', I[-1] if I else '?', 'LUFS')

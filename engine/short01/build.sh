#!/bin/bash
# short01: render 1080x1920 + sound -> renders/short01/short01.mp4   (serve repo root on :8765 first)
set -e; cd "$(dirname "$0")/../.."
D=renders/short01; mkdir -p $D
[ -f $D/video.mp4 ] || SCALE=1 JPEGQ=97 CRF=15 PRESET=medium WORKERS=2 node engine/short01/render.js short $D/video.mp4
python3 engine/short01/sfx.py $D/sfx.wav $D/bed.wav
CH="adelay=150:all=1,highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=120"
J=$(ffmpeg -hide_banner -i audio/short01/vo.wav -af "$CH,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$J" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -y -loglevel error -i audio/short01/vo.wav -af "$CH,loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" -ar 48000 -ac 2 $D/vo.wav
ffmpeg -y -loglevel error -i $D/vo.wav -i $D/sfx.wav -i $D/bed.wav -filter_complex \
 "[0]apad,asplit=2[v][sc];[1]volume=-4dB[s];[2]volume=-14dB[b0];[b0][sc]sidechaincompress=threshold=0.03:ratio=4:attack=30:release=400[b];[v][s][b]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.89:level=false[m]" \
 -map "[m]" -ar 48000 -t $(python3 -c "import json;print(json.load(open('engine/short01/timing.json'))['duration'])") $D/mix.wav
ffmpeg -y -loglevel error -i $D/video.mp4 -i $D/mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -maxrate 12M -bufsize 24M -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest $D/short01.mp4
echo done $D/short01.mp4

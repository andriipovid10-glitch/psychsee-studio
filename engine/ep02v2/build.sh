#!/usr/bin/env bash
# EP02 v2 first 30 s: timing -> render -> mix, in one command.
#   bash engine/ep02v2/build.sh            # full build, 960x540 draft (SCALE=1 for 1920x1080)
#   bash engine/ep02v2/build.sh --stills   # re-time + 6 check stills
#   bash engine/ep02v2/build.sh --mix      # audio only
# Your own voice: put it at audio/ep02v2/vo_s00.wav (it wins over vo_temp_s00.wav).
set -euo pipefail
cd "$(dirname "$0")/../.."
MODE="${1:-full}"
[ "$MODE" != "--mix" ] && python3 engine/ep02v2/align.py s00
[ -d engine/node_modules/three ] || (cd engine && npm install)
curl -s -o /dev/null http://localhost:8765/engine/ep02v2/cues.json || { (python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1; }
if [ "$MODE" = "--stills" ]; then node engine/ep02v2/render.js s00 renders/ep02v2/stills/s00 3.0,3.7,4.6,7.9,24.6,31.5; exit 0; fi
[ "$MODE" = "full" ] && WORKERS=${WORKERS:-2} node engine/ep02v2/render.js s00 renders/ep02v2/scene00.mp4
python3 engine/ep02v2/mix.py renders/ep02v2/ep02v2_first30s_draft.mp4

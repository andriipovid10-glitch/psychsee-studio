#!/usr/bin/env bash
# EP02 first minute: timing -> render -> mix, in one command.
#   bash engine/ep02/build.sh            # full build (uses audio/ep02/vo_sNN.wav if present, else vo_temp_sNN.wav)
#   bash engine/ep02/build.sh --stills   # only re-time + check stills (fast)
#   bash engine/ep02/build.sh --mix      # only re-mix audio (videos already rendered)
set -euo pipefail
cd "$(dirname "$0")/../.."
SCENES="s00 s01"
MODE="${1:-full}"

if [ "$MODE" != "--mix" ]; then
  for s in $SCENES; do python3 engine/ep02/align.py "$s"; done
fi
[ -d engine/node_modules/three ] || (cd engine && npm install)
if ! curl -s -o /dev/null http://localhost:8765/engine/ep02/cues.json; then
  (python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1
fi
if [ "$MODE" = "--stills" ]; then
  node engine/ep02/render.js s00 renders/ep02/stills/s00 2.9,6,9.6,13.8,21,28.4
  node engine/ep02/render.js s01 renders/ep02/stills/s01 2.8,11,18.8,24.8,33,43.5
  exit 0
fi
if [ "$MODE" = "full" ]; then
  node engine/ep02/render.js s00 renders/ep02/scene00.mp4
  node engine/ep02/render.js s01 renders/ep02/scene01.mp4
fi
python3 engine/ep02/mix.py renders/ep02/ep02_first_minute_draft.mp4

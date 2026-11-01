# EP02 v2 — first 30 seconds (draft)

Rewrite after the creator's feedback on `engine/ep02`: simple, punchy keywords on every beat, real-looking places, inside-the-body only as a 1–2 s accent.
Script: `scripts/ep02-v2.md` (section `// 00`).

## Build
```bash
bash engine/ep02v2/build.sh            # 960x540 draft (~1.5 s/frame on 2 cloud cores → ~15–20 min)
SCALE=1 bash engine/ep02v2/build.sh    # 1920x1080 final, only after approval
bash engine/ep02v2/build.sh --stills   # 6 check stills
bash engine/ep02v2/build.sh --mix      # audio only
```
Own voice: record the whole `// 00` VO as `audio/ep02v2/vo_s00.wav` and rebuild. Every beat re-times itself (cues in `cues.json`).

## Shots (all timed from VO cue words)
void (your first fight?) → SCHOOL corridor → BAR → night STREET (each with a stickman crowd watching) →
PANIC / HEART SLAMMING (1.5 s x-ray) / HANDS SHAKING / DRY MOUTH close-ups → SILENCE (world desaturates) → SLOW MOTION punch with ghost trail →
freeze: 6 icons, lines to the body, red scanner on "one of them is a lie" → 1 s push into the chest → 0.00 s clock + THE FIRST 10 SECONDS.

## Files
| file | what |
|---|---|
| `scene00.html` | the scene (`window.draw(t)`), reuses `engine/ep02/lib/core.js` (rig, chest, helpers) |
| `lib/stage.js` | light stage: render size from `?s=` (0.5 = draft), no bloom, 1024 shadows |
| `lib/sets.js` | 3D locations with procedural canvas textures (lockers, cinder block, brick, wood, wet asphalt, lit windows, neon signs) |
| `render.js` | Playwright → ffmpeg, `SCALE` env (default 0.5), 2 workers |
| `align.py`, `cues.json`, `timing_s00.json`, `asr/` | VO word timing (Speko transcription of the temp VO) |
| `sfx.py`, `mix.py`, `build.sh` | procedural sound, mix (VO −16 LUFS), one-command build |

Temp voice: Speko → Gemini TTS, voice Charon, emotional style prompt, pauses tightened, ×1.05 (`audio/ep02v2/vo_temp_s00.wav`).

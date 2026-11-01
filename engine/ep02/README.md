# EP02 — "What Happens to Your Body in the First 10 Seconds of a Fight"

Status: **first minute only** (sections `// 00 COLD OPEN` and `// 01 THE ALARM`), draft with a temporary AI voice.
Sections 02+ are not started yet; they wait for approval of this minute.

## Swap in your own voice (tomorrow)

1. Record each section as its own file and put it here (WAV, any sample rate; trim leading silence to ~0.2 s):
   - `audio/ep02/vo_s00.wav` — the `// 00` VO
   - `audio/ep02/vo_s01.wav` — the `// 01` VO
   From an iPhone/Mac `.m4a`: `ffmpeg -i s00.m4a -ac 1 -ar 48000 audio/ep02/vo_s00.wav`
2. Run one command from the repo root:
   ```bash
   bash engine/ep02/build.sh
   ```
   It re-measures word timings (→ `engine/ep02/timing_s00.json`, `timing_s01.json`), re-renders both scenes
   (every animation beat follows the new timings) and re-mixes → `renders/ep02/ep02_first_minute_draft.mp4`.
   `vo_sNN.wav` automatically wins over `vo_temp_sNN.wav`; delete your file to fall back to the temp voice.

Faster loops: `bash engine/ep02/build.sh --stills` (re-time + 12 check stills), `bash engine/ep02/build.sh --mix` (audio only).

### Where word timings come from (`align.py`)
Tried in this order:
1. an ASR json for that file: `engine/ep02/asr/<audio-name>.asr.json` (Speko `audio.transcribe` with `word_timestamps`, or whisper json),
2. `faster-whisper` if installed (`pip install faster-whisper`; downloads a model from huggingface.co — works on a Mac, blocked in the cloud sandbox),
3. silence detection + the known script text (no model). Measured against Speko on the temp VO: cue error 0.07 s mean (s00), 0.19 s mean / 0.64 s worst (s01).
The VO text is read verbatim from `scripts/ep02-first-10-seconds-of-a-fight.md`, so if you ad-lib a word, the aligner still matches the rest.

## How timing works
- `cues.json` names the word that triggers each beat, e.g. `"shove": "shoves"`, `"permission": "you#2.end"` (2nd "you", its end), plus `lead`/`tail` seconds per scene and the T+ story-clock range.
- `align.py` → `timing_sNN.json` = word times + cue times in scene seconds + scene duration. The scenes only call `cue('shove')` etc.; there are no hard-coded seconds for VO beats.
- `sfx.py` places every sound on the same cues, so sound re-syncs too.

## Files
| file | what |
|---|---|
| `scene00.html`, `scene01.html` | the two scenes (`window.draw(t)`, pure function of time) |
| `lib/core.js` | renderer, lights, bloom, colour grade (selective desaturation keeps red), stickman rig, camera + DOM helpers |
| `lib/brain.js` | x-ray head: gyri cortex, cerebellum, brainstem + cord, eyes, optic nerve → chiasm → tract → LGN → radiation → visual cortex, amygdala, hypothalamus + pituitary |
| `lib/set.js` | the fight set (shove choreography, freeze, 7 decision nodes) shared by both scenes |
| `lib/tclock.js` | reusable `T+0.00s` story clock (keeps running through the whole episode) |
| `lib/hud.css` | Inter / mono showreel HUD, cards, labels, reticles |
| `render.js` | Playwright → JPEG frames → ffmpeg (1920×1080, 30 fps, x264 veryfast crf 19), parallel workers |
| `align.py`, `cues.json`, `timing_*.json`, `asr/` | VO timing |
| `sfx.py`, `mix.py`, `build.sh` | sound design, mix (VO HPF 80 Hz + compression + loudnorm −16 LUFS, SFX under VO, ducked drone bed), one-command build |

## Anatomy notes (stylised, positions follow MNI-style landmarks)
eyes front-low · optic nerve from the back of each eye to the chiasm (in front of the pituitary stalk) · optic tract → LGN (thalamus) → optic radiation → visual cortex at the occipital pole ·
amygdala deep in the medial temporal lobe, lateral to and level with the hypothalamus · hypothalamus midline at the base of the brain, pituitary hanging below ·
fast "low road" thalamus → amygdala in red, slow path to visual cortex stays grey ("loading").

## Temp voice
Speko `audio.synthesize` → Google Gemini TTS (gemini-3.8-flash-lite-tts), voice **Charon**, en-US, style prompt "calm but intense documentary narrator",
sped up ×1.08 with ffmpeg `atempo` to reach ~150 wpm. Word timestamps: Speko `audio.transcribe` (gemini-3.5-transcribe).

## Credits — Oneshotted recipes that shaped techniques (not copied)
- "Evolution Of The Eye Explainer" by @cagrimbakirci — glass-like translucent eye, light-ray path, synced bottom timeline → our eye glass shader, light pulse along the optic nerve, 0–10 s ruler. https://oneshotted.io/v/evolution-of-the-eye-explainer
- "Ethereal Body Scan Silhouette Art" by @sato_neet — scan line + targeting reticles over a glowing figure → x-ray scan sweep and organ reticles. https://oneshotted.io/v/motion-piece-by-at-sato-neet-qhzyw
- "Kinetic type bumper for a creator brand" by @techhalla — print misregistration on impact frames only, closed-form springs, pre-pass stills → red headline slams and the MYTH stamp. https://oneshotted.io/v/kinetic-type-bumper-for-a-creator-brand

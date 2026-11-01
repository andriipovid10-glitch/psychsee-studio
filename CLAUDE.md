# PsychSee Studio — instructions for Claude Code

This repo produces videos for the YouTube channel **PsychSee** (@psychsee): 3D stickman motion graphics about psychology and what happens inside the body and brain. English, US audience.

The creator writes to you in **Ukrainian** — answer in Ukrainian. Everything that goes into the video (voiceover, on-screen text, titles) is in **English**.
The creator often can't open files or links you send: put short text (prompts, script edits, lists) directly in your chat message.

## Read first
1. `STYLE_GUIDE.md` — the look, camera, typography, sound and retention rules. Follow it.
2. `engine/reference-ep00/` — the approved 3D test ("Your body can't lie", variant `dark`). It is the visual reference AND working code to build on. Reuse its stickman rig, x-ray, lights, bloom, DOM typography, cards and render pipeline.
3. The episode script in `scripts/` that you were asked to make.

## How the engine works
- `scene.html` — one Three.js scene + HTML/CSS overlay. Everything is a pure function of time: `window.draw(t)` sets the 3D scene and the DOM for second `t`. No real-time animation, no randomness without a fixed seed. This makes renders frame-exact.
- `render.js` — Playwright opens the page, calls `draw(i/30)` for each frame, screenshots it (JPEG q92) and pipes frames into ffmpeg (H.264). `node render.js dark out.mp4` renders a video; `node render.js dark stills/x 1.0,4.5,8.0` renders check stills.
- `sfx.py` — procedural sound design with numpy (heartbeats, clicks, whooshes, drones, impacts). Retime it per scene.

Setup:
```
cd engine && npm install
cd .. && python3 -m http.server 8765    # serve the repo root (ES modules need http, not file://)
node engine/reference-ep00/render.js dark renders/ref.mp4
```
Chromium + Playwright are preinstalled in the cloud environment (don't reinstall Playwright). WebGL runs through SwiftShader: launch Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` (already in render.js).

## How to build an episode
1. Create `engine/epXX/` and split the script into scenes (one scene ≈ one script section, 20–60 s). One HTML + one render per scene.
2. Before any full render: render 3–5 stills per scene at the busiest moments and look at them. Fix framing, overlaps, text collisions first.
3. Render each scene to `renders/epXX/sceneN.mp4` (write to `*.part.mp4`, rename on success). Same size, fps and encoder settings for every scene.
4. Timing comes from the creator's voice recording in `audio/`. Measure the VO (silence detection / transcription with word timestamps) and time the animation to it. If there is no recording yet, time to ~150 words per minute and mark it as a draft.
5. Concat scenes with `-c copy`, then mix VO + SFX (`-c:v copy`). VO: high-pass 80 Hz, light compression, loudnorm to −16 LUFS. SFX under the VO.
6. Deliver: send the finished MP4 to the creator and tell them in one or two lines what's in it.

## Rules
- Characters are 3D stickmen with simple faces (eyes, brows, nose, mouth) and simple clothes — see STYLE_GUIDE §1.
- Never put text labels in the screen corners (section labels, timecodes, episode tags, clocks).
- Show body parts on our own stickman (his eye, his hand, his mouth, fingers on his neck) clearly, rather than photos of real human organs, unless an organ can't be shown on the stickman.
- Quality: final renders at 1920x1080, high bitrate.
- Camera never sits still longer than ~6 s. Something changes every 3–6 s.
- Red is reserved for the important thing (stress, the lie, the reveal).
- Facts must be accurate. Use the fact notes in the script; if you add a claim, verify it and hedge estimates ("by some estimates").
- Don't commit `node_modules/` or renders. Commit scene code, scripts and small assets.

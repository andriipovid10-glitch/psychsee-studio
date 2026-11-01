# PsychSee — Style Guide

Channel: **PsychSee** (@psychsee). English, US audience (mostly guys 18–24).
Niche: psychology + what happens in the **body and brain** (the creator studies physiotherapy — use real anatomy, it is our edge).
Every video should make the viewer think *"I never thought about this"* — and test it on themselves.

The approved look is the **3D dark** reference test: `engine/reference-ep00` (variant `dark`).
Open it and match it. When in doubt, copy what it does.

## 1. Characters
- **Plain stickmen, in 3D.** Sphere head, thin cylinder limbs with rounded joints. **No faces, no clothes, no hair.** Emotion is shown with **body language** only (posture, arms, head tilt, speed of movement, shaking, sweat drops).
- Colour: soft white `#e6ebf5`, slightly glossy (roughness ~0.42).
- Every person in an example is a stickman. Never realistic humans.
- They should move **all the time**: idle breathing bob, weight shifts, gestures on key words.

## 2. World & light (dark variant)
- Background / fog: deep navy `#0b1222`.
- Light: dim cool hemisphere + soft key light from top-left + **strong cool-blue rim light** from behind (`#7fb2ff`) so silhouettes pop.
- Soft shadows on an invisible floor.
- Bloom only on things that glow (heart, brain, nerves). Keep it subtle: strength ~0.55, threshold ~0.92.

## 3. The "X-ray" (signature move)
- The body turns semi-transparent (opacity → ~0.16) and we see **inside**: heart, ribs, brain, nerves, eyes, glands.
- Inner organs glow. Accent colour **red `#e3262d` / `#ff3340`** = stress, danger, the lie, the important thing.
- A red point light inside the body pulses with the heartbeat and lights the body from within.
- Use real anatomy (cerebellum, optic nerve, retina, amygdala, adrenal glands...). Label organs with small mono labels.

## 4. Camera
- **Always moving.** Slow orbit on wide shots, eased push-ins, dramatic swoops (arc the path, don't slide in a straight line).
- Signature: **dive into the body** — the camera flies into the chest/head/eye and the scene continues inside.
- Cut or change angle every **3–6 seconds**. A static frame longer than 6 s is a bug.
- Small camera shake when tension peaks.

## 5. Typography & UI
- Headlines: **Inter 800–900**, tight letter-spacing (−0.03 to −0.05em), white. One key word in red.
- Words animate in one by one (slide up from blur, back-ease overshoot).
- Speech: words appear **over the speaker's head**, with a small mono tag (`// question`, `// answer`).
- Mono "showreel" details (DejaVu Sans Mono, uppercase, letter-spacing .06em, grey `#8a97b3`):
  - top-left: section label `// 03 — inside the body`
  - top-right: `PSYCHSEE  00:00:07:15` running timecode
  - bottom-left: episode tag
- Data cards (dark glass `rgba(20,30,52,.82)`, 22px radius): big number + mono label (heart rate, cortisol, etc.). Slide in from the right, staggered.
- Live graphs: ECG line, counters that tick up.

## 6. Sound
- Voiceover = the creator's own voice (normalise to about −16 LUFS, light compression, high-pass 80 Hz).
- Sound design is **procedural** (see `engine/reference-ep00/sfx.py`): heartbeat thumps, UI clicks on every word/card, whooshes on camera moves, sub drone under tension, a big impact on the reveal.
- No copyrighted music. Background music is added by the creator in editing, or leave a quiet drone.

## 7. Retention rules (YouTube)
1. **Hook in the first 5 seconds.** No "hi guys", no intro. Start with the shocking claim.
2. **Open loops.** Promise something later ("I'll test you at the end") and pay it off.
3. **Escalation.** Each point stronger than the last. Best one at the end.
4. **Interaction.** The viewer tests things on themselves during the video.
5. **Visual change every 3–6 s.** New angle, new element, new text, new sound.
6. **Silence is a tool.** One beat of silence before the biggest reveal.
7. End with a question for the comments + a pointer to the next video.

## 8. Technical
- 1920×1080, 30 fps, H.264 (`-preset veryfast -crf 19`), AAC 192k.
- One file per scene, then concat (`-c copy`), then add audio (`-c:v copy`).
- Thumbnails: 1280×720, dark, translucent 3D stickman head with glowing organ, 2–3 words of huge text with one red word.

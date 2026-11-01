# PsychSee Studio

Production repo for the **PsychSee** YouTube channel — 3D stickman motion graphics about psychology, the body and the brain.

- `STYLE_GUIDE.md` — channel look & retention rules
- `CLAUDE.md` — how Claude Code builds videos here
- `engine/reference-ep00/` — approved 3D style test (Three.js + Playwright + ffmpeg)
- `scripts/` — episode scripts
- `audio/` — voiceover recordings

## Workflow
1. Script is written and approved (`scripts/epXX-*.md`).
2. Creator records the voiceover → `audio/epXX-vo.m4a`.
3. Claude Code: "make the video from scripts/epXX-….md" → renders scenes, mixes audio, delivers MP4.

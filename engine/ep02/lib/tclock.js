// T+ story clock — the "seconds into the fight" counter that runs through the whole episode.
// Usage: const clk = makeTClock(document.body); clk.update(t, story, sceneDuration, cue, opts)
//   story = cues.json[scene].story = {from_cue, t0, t1}; the clock runs t0 -> t1 between from_cue and scene end.
const CSS = `
#tclock{position:absolute;right:56px;bottom:40px;text-align:right;font-family:'DejaVu Sans Mono',monospace;color:#eef2fa;
  transform-origin:100% 100%;will-change:transform}
#tclock .lab{font-size:18px;letter-spacing:.14em;color:#8a97b3;text-transform:uppercase;margin-bottom:6px}
#tclock .lab i{display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff3340;margin-right:10px;box-shadow:0 0 12px #ff3340;vertical-align:1px}
#tclock .val{font-size:56px;font-weight:700;letter-spacing:-.02em}
#tclock .val small{font-size:30px;color:#8a97b3;margin-left:4px}`;
export function makeTClock(parent) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'tclock';
  el.innerHTML = `<div class="lab"><i></i>since the shove</div><div class="val">T+<span>0.00</span><small>s</small></div>`;
  parent.appendChild(el);
  const num = el.querySelector('.val span'), dot = el.querySelector('.lab i');
  return {
    el,
    value(t, story, dur, cue) {
      const a = story.from_cue ? cue(story.from_cue) : 0;
      const k = Math.max(0, Math.min(1, (t - a) / (dur - a)));
      return story.t0 + (story.t1 - story.t0) * k;
    },
    // big: 0..1 moves the clock from the corner to screen centre at 2.6x size
    update(t, story, dur, cue, {opacity = 1, big = 0} = {}) {
      const v = this.value(t, story, dur, cue);
      num.textContent = v.toFixed(2);
      el.style.opacity = opacity; el.style.visibility = opacity > .001 ? 'visible' : 'hidden';
      const sc = 1 + 1.6 * big, dx = -(1920 / 2 - 56 - 150) * big, dy = -(1080 / 2 - 40 - 80) * big;
      el.style.transform = `translate(${dx}px,${dy}px) scale(${sc})`;
      dot.style.opacity = (Math.floor(t * 2) % 2) ? .35 : 1;
      return v;
    }
  };
}

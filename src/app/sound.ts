// Alert sounds via WebAudio (no audio assets). Browsers only allow sound after a user gesture,
// so the first tap anywhere unlocks the context.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* audio unavailable */
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.18, type: OscillatorType = 'sine') {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
}

/** Critical alert: a ~3 s two-tone siren. */
export function playAlarm() {
  unlockAudio();
  for (let i = 0; i < 6; i++) {
    tone(880, i * 0.5, 0.24, 0.22, 'square');
    tone(660, i * 0.5 + 0.25, 0.24, 0.22, 'square');
  }
}

/** Soft chime for check-ins and quiet updates. */
export function playChime() {
  unlockAudio();
  tone(988, 0, 0.18, 0.12);
  tone(1319, 0.14, 0.3, 0.12);
}

/** Vibration where supported (not iOS Safari: DESIGN §2.3); callers pair it with a visual shake. */
export function vibrate(pattern: number | number[] = [400, 200, 400]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

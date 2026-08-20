// Звук через Web Audio API: никаких внешних файлов (дизайн-документ, п. 10).
// § 1.3 / § 4.7 — звук паузится при потере фокуса и на время рекламы.

let ctx = null;
let master = null;
let enabled = true;
let suspended = false;

function ensureContext() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  return ctx;
}

// Вызывать из обработчика пользовательского ввода: браузеры запускают звук только так.
export function unlockAudio() {
  const context = ensureContext();
  if (context && context.state === 'suspended' && !suspended) context.resume().catch(() => {});
}

export function setSoundEnabled(value) {
  enabled = !!value;
  if (!enabled) pauseAllAudio();
  else resumeAllAudio();
}

export function isSoundEnabled() {
  return enabled;
}

export function pauseAllAudio() {
  suspended = true;
  if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
}

export function resumeAllAudio() {
  suspended = false;
  if (enabled && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function tone({ freq = 440, to = freq, dur = 0.09, type = 'square', gain = 0.5, delay = 0 }) {
  if (!enabled || suspended) return;
  const context = ensureContext();
  if (!context || context.state !== 'running') return;
  const t0 = context.currentTime + delay;
  const osc = context.createOscillator();
  const env = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  hit(power = 0) {
    const base = 520 + power * 260;
    tone({ freq: base, to: base * 0.6, dur: 0.07, type: 'square', gain: 0.5 });
  },
  wall() {
    tone({ freq: 240, to: 170, dur: 0.06, type: 'triangle', gain: 0.35 });
  },
  point(scoredByPlayer) {
    if (scoredByPlayer) {
      tone({ freq: 620, dur: 0.1, type: 'square', gain: 0.4 });
      tone({ freq: 880, dur: 0.14, type: 'square', gain: 0.4, delay: 0.09 });
    } else {
      tone({ freq: 330, to: 200, dur: 0.18, type: 'sawtooth', gain: 0.3 });
    }
  },
  serve() {
    tone({ freq: 440, dur: 0.05, type: 'triangle', gain: 0.25 });
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => {
      tone({ freq: f, dur: 0.16, type: 'square', gain: 0.4, delay: i * 0.11 });
    });
  },
  lose() {
    [392, 330, 262].forEach((f, i) => {
      tone({ freq: f, dur: 0.22, type: 'sawtooth', gain: 0.32, delay: i * 0.14 });
    });
  },
  ui() {
    tone({ freq: 660, dur: 0.05, type: 'square', gain: 0.25 });
  },
};

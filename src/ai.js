// Соперник (дизайн-документ, п. 6): предсказание траектории, задержка реакции,
// ограниченная скорость ракетки и правдоподобная ошибка вместо случайных промахов.

import { CONFIG, TABLE, DIFFICULTY, clamp } from './config.js';

export function createAi() {
  return {
    preset: DIFFICULTY.normal,
    targetX: TABLE.cx,
    targetY: TABLE.top + 12,
    errorOffset: 0,
    wait: 0,
    recalc: 0,
    incoming: false,
  };
}

export function setAiDifficulty(brain, difficulty) {
  brain.preset = DIFFICULTY[difficulty] || DIFFICULTY.normal;
}

export function resetAi(brain) {
  brain.targetX = TABLE.cx;
  brain.targetY = TABLE.top + 12;
  brain.errorOffset = 0;
  brain.wait = 0;
  brain.recalc = 0;
  brain.incoming = false;
}

// Экстраполяция траектории мяча до линии ракетки ИИ с учётом отскоков от боковых линий.
function predictX(ball, lineY, readSpin) {
  const h = 1 / 90;
  let { x, y, vx, vy, spin } = ball;
  const left = TABLE.left + CONFIG.BALL_R;
  const right = TABLE.right - CONFIG.BALL_R;
  for (let i = 0; i < 400; i++) {
    if (readSpin) {
      spin *= Math.pow(CONFIG.SPIN_DECAY, h / CONFIG.PHYS_STEP);
      vx += spin * CONFIG.SPIN_FORCE * h;
    }
    x += vx * h;
    y += vy * h;
    if (x < left) { x = left + (left - x); vx = -vx * CONFIG.WALL_DAMPING; }
    else if (x > right) { x = right - (x - right); vx = -vx * CONFIG.WALL_DAMPING; }
    if (y <= lineY) break;
  }
  return Math.min(right, Math.max(left, x));
}

export function updateAi(game, dt) {
  const brain = game.brain;
  const paddle = game.ai;
  const ball = game.ball;
  const preset = brain.preset;
  const homeY = TABLE.top + 12;

  const approaching = game.state === 'rally' && ball.vy < 0;

  if (approaching && !brain.incoming) {
    // Мяч только что пошёл к ИИ: реакция не мгновенная (п. 6.1.4).
    brain.incoming = true;
    brain.wait = preset.reaction;
    brain.recalc = 0;
    brain.errorOffset = (Math.random() * 2 - 1) * preset.error;
  } else if (!approaching) {
    brain.incoming = false;
  }

  if (game.state === 'serve' && game.server === 'ai') {
    // Подающий ИИ отводит ракетку к центру.
    brain.targetX = TABLE.cx + Math.sin(performance.now() / 600) * 40;
    brain.targetY = homeY;
  } else if (brain.incoming) {
    brain.wait -= dt;
    if (brain.wait <= 0) {
      brain.recalc -= dt;
      if (brain.recalc <= 0) {
        brain.recalc = 0.12;
        const line = paddle.y + CONFIG.PADDLE_R * 0.6;
        brain.targetX = predictX(ball, line, preset.readSpin) + brain.errorOffset;
      }
      brain.targetY = homeY + 70;
    }
  } else {
    brain.targetX = TABLE.cx + (ball.x - TABLE.cx) * 0.15;
    brain.targetY = homeY;
  }

  const maxStep = preset.speed * dt;
  const dx = clamp(brain.targetX - paddle.x, -maxStep, maxStep);
  const dy = clamp(brain.targetY - paddle.y, -maxStep * 0.7, maxStep * 0.7);
  paddle.x = clamp(paddle.x + dx, paddle.minX, paddle.maxX);
  paddle.y = clamp(paddle.y + dy, paddle.minY, paddle.maxY);
}

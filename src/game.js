// Ядро игры: состояние матча, физика мяча (фиксированный шаг + swept collision),
// удары по ракетке, подачи и подсчёт очков.

import { CONFIG, TABLE } from './config.js';
import { sfx } from './audio.js';
import { createAi, setAiDifficulty, resetAi, updateAi } from './ai.js';
import { createEffects, updateEffects, spawnHitParticles, spawnWallParticles, flashScore } from './effects.js';

export const STATE = {
  MENU: 'menu',
  SERVE: 'serve',
  RALLY: 'rally',
  POINT: 'point',
  PAUSE: 'pause',
  OVER: 'over',
};

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

function createPaddle(isPlayer) {
  const r = CONFIG.PADDLE_R;
  return {
    isPlayer,
    r,
    x: TABLE.cx,
    y: isPlayer ? TABLE.bottom - 10 : TABLE.top + 12,
    px: TABLE.cx,
    py: isPlayer ? TABLE.bottom - 10 : TABLE.top + 12,
    vx: 0,
    vy: 0,
    cooldown: 0,
    minX: TABLE.left - 25,
    maxX: TABLE.right + 25,
    minY: isPlayer ? TABLE.net + 45 : TABLE.top - 70,
    maxY: isPlayer ? TABLE.bottom + 70 : TABLE.net - 45,
  };
}

export function createGame() {
  const game = {
    state: STATE.MENU,
    prevState: STATE.MENU,
    difficulty: 'normal',
    score: { player: 0, ai: 0 },
    startServer: 'player',
    server: 'player',
    matchOver: false,
    winner: null,
    rallySpeed: CONFIG.BASE_SPEED,
    rallyHits: 0,
    bestRallyInMatch: 0,
    timer: 0,
    rewardUsed: false,
    ball: { x: TABLE.cx, y: TABLE.net, vx: 0, vy: 0, spin: 0 },
    trail: [],
    player: createPaddle(true),
    ai: createPaddle(false),
    brain: createAi(),
    fx: createEffects(),
    input: { active: false, x: TABLE.cx, y: TABLE.bottom - 10, keyX: 0, keyY: 0 },
    onPoint: null,
    onMatchEnd: null,
  };
  return game;
}

// Подача переходит каждые 2 очка, а при счёте 10:10 — каждое очко.
function serverFor(game) {
  const { player, ai } = game.score;
  const total = player + ai;
  const swaps = player >= 10 && ai >= 10 ? 10 + (total - 20) : Math.floor(total / 2);
  const other = game.startServer === 'player' ? 'ai' : 'player';
  return swaps % 2 === 0 ? game.startServer : other;
}

export function startMatch(game, difficulty) {
  game.difficulty = difficulty;
  setAiDifficulty(game.brain, difficulty);
  game.score.player = 0;
  game.score.ai = 0;
  game.startServer = Math.random() < 0.5 ? 'player' : 'ai';
  game.matchOver = false;
  game.winner = null;
  game.bestRallyInMatch = 0;
  game.rewardUsed = false;
  game.fx.particles.length = 0;
  game.fx.flash = 0;
  resetPaddles(game);
  beginServe(game);
}

function resetPaddles(game) {
  const p = game.player;
  const a = game.ai;
  p.x = TABLE.cx; p.y = TABLE.bottom - 10; p.px = p.x; p.py = p.y; p.vx = 0; p.vy = 0; p.cooldown = 0;
  a.x = TABLE.cx; a.y = TABLE.top + 12; a.px = a.x; a.py = a.y; a.vx = 0; a.vy = 0; a.cooldown = 0;
  game.input.x = p.x;
  game.input.y = p.y;
  game.input.active = false;
  resetAi(game.brain);
}

export function beginServe(game) {
  game.server = serverFor(game);
  game.state = STATE.SERVE;
  game.timer = CONFIG.SERVE_DELAY;
  game.rallySpeed = CONFIG.BASE_SPEED;
  game.rallyHits = 0;
  game.trail.length = 0;
  game.ball.spin = 0;
  game.ball.vx = 0;
  game.ball.vy = 0;
  game.player.cooldown = 0;
  game.ai.cooldown = 0;
  placeBallOnServer(game);
}

function placeBallOnServer(game) {
  const paddle = game.server === 'player' ? game.player : game.ai;
  const gap = CONFIG.PADDLE_R + CONFIG.BALL_R + 6;
  game.ball.x = clamp(paddle.x, TABLE.left + CONFIG.BALL_R, TABLE.right - CONFIG.BALL_R);
  game.ball.y = paddle.y + (game.server === 'player' ? -gap : gap);
}

function launchServe(game) {
  const dir = game.server === 'player' ? -1 : 1;
  const angle = (Math.random() * 2 - 1) * 0.34; // небольшой разброс подачи
  game.ball.vx = Math.sin(angle) * CONFIG.BASE_SPEED;
  game.ball.vy = Math.cos(angle) * CONFIG.BASE_SPEED * dir;
  game.ball.spin = 0;
  game.state = STATE.RALLY;
  sfx.serve();
}

// ---------------------------------------------------------------- ракетка игрока

function updatePlayer(game, dt) {
  const p = game.player;
  const input = game.input;

  if (input.keyX || input.keyY) {
    const step = 900 * dt;
    input.x = clamp(input.x + input.keyX * step, p.minX, p.maxX);
    input.y = clamp(input.y + input.keyY * step, p.minY, p.maxY);
  }

  const targetX = clamp(input.x, p.minX, p.maxX);
  const targetY = clamp(input.y, p.minY, p.maxY);

  // Сглаживание, не зависящее от частоты кадров: ракетка имеет «вес».
  const k = 1 - Math.pow(1 - CONFIG.PADDLE_LERP, dt * 60);
  let nx = p.x + (targetX - p.x) * k;
  let ny = p.y + (targetY - p.y) * k;

  // Ограничение скорости ракетки, иначе рывок пальца даёт нереальный удар.
  const maxStep = CONFIG.PADDLE_MAX_SPEED * dt;
  const dx = nx - p.x;
  const dy = ny - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist > maxStep && dist > 0) {
    nx = p.x + (dx / dist) * maxStep;
    ny = p.y + (dy / dist) * maxStep;
  }

  p.x = clamp(nx, p.minX, p.maxX);
  p.y = clamp(ny, p.minY, p.maxY);
}

function syncPaddleVelocity(paddle, dt) {
  paddle.vx = dt > 0 ? (paddle.x - paddle.px) / dt : 0;
  paddle.vy = dt > 0 ? (paddle.y - paddle.py) / dt : 0;
}

// ---------------------------------------------------------------- физика мяча

// Наименьшее t из [0, 1], когда точка p0 + t*d оказывается на расстоянии R от начала координат.
function sweepCircle(p0x, p0y, dx, dy, R) {
  const a = dx * dx + dy * dy;
  const c = p0x * p0x + p0y * p0y - R * R;
  if (c <= 0) return 0;
  if (a < 1e-9) return -1;
  const b = 2 * (p0x * dx + p0y * dy);
  if (b >= 0) return -1; // удаляется — столкновения не будет
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

function resolveHit(game, paddle, contactX, contactY) {
  const ball = game.ball;
  const isPlayer = paddle.isPlayer;
  const dir = isPlayer ? -1 : 1;

  const offset = clamp((contactX - paddle.x) / paddle.r, -1, 1);
  const approach = isPlayer ? Math.max(0, -paddle.vy) : Math.max(0, paddle.vy);

  game.rallySpeed = Math.min(
    CONFIG.MAX_SPEED,
    game.rallySpeed * CONFIG.SPEED_STEP + approach * CONFIG.POWER_FACTOR,
  );

  const vx = offset * CONFIG.MAX_ANGLE_SPEED + paddle.vx * 0.15;
  const rest = game.rallySpeed * game.rallySpeed - vx * vx;
  const vy = Math.max(CONFIG.MIN_VY, Math.sqrt(Math.max(rest, 0))) * dir;

  ball.vx = vx;
  ball.vy = vy;
  ball.spin = clamp(
    (paddle.vx / CONFIG.SPIN_REF) * CONFIG.SPIN_FACTOR,
    -CONFIG.SPIN_MAX,
    CONFIG.SPIN_MAX,
  );

  // Выталкиваем мяч из ракетки, чтобы столкновение не сработало повторно.
  ball.x = contactX;
  ball.y = contactY;
  const nx = contactX - paddle.x;
  const ny = contactY - paddle.y;
  const len = Math.hypot(nx, ny) || 1;
  ball.x += (nx / len) * 2;
  ball.y += (ny / len) * 2;

  paddle.cooldown = CONFIG.HIT_COOLDOWN;
  game.rallyHits++;
  game.bestRallyInMatch = Math.max(game.bestRallyInMatch, game.rallyHits);

  spawnHitParticles(
    game.fx,
    contactX,
    contactY,
    dir,
    isPlayer ? '#a8232f' : '#0f8fad',
  );
  sfx.hit(clamp(approach / 900, 0, 1) + (game.rallySpeed - CONFIG.BASE_SPEED) / CONFIG.MAX_SPEED);
}

function stepBall(game, h) {
  const ball = game.ball;
  const left = TABLE.left + CONFIG.BALL_R;
  const right = TABLE.right - CONFIG.BALL_R;

  // Подкрутка искривляет траекторию и постепенно гаснет (п. 5.2).
  ball.spin *= Math.pow(CONFIG.SPIN_DECAY, h / CONFIG.PHYS_STEP);
  ball.vx += ball.spin * CONFIG.SPIN_FORCE * h;

  let remaining = h;
  let elapsed = 0;
  let guard = 0;

  while (remaining > 1e-6 && guard++ < 5) {
    let bestT = 1;
    let hitPaddle = null;
    let wall = 0;

    // Боковые линии стола.
    if (ball.vx < 0) {
      const t = (left - ball.x) / (ball.vx * remaining);
      if (t >= 0 && t < bestT) { bestT = t; wall = -1; hitPaddle = null; }
    } else if (ball.vx > 0) {
      const t = (right - ball.x) / (ball.vx * remaining);
      if (t >= 0 && t < bestT) { bestT = t; wall = 1; hitPaddle = null; }
    }

    // Ракетки: swept collision по отрезку движения (п. 5.5).
    for (const paddle of [game.player, game.ai]) {
      if (paddle.cooldown > 0) continue;
      // Ракетка отбивает только летящий к ней мяч — двойные удары исключены.
      if (paddle.isPlayer ? ball.vy <= 0 : ball.vy >= 0) continue;
      const px = paddle.px + paddle.vx * elapsed;
      const py = paddle.py + paddle.vy * elapsed;
      const t = sweepCircle(
        ball.x - px,
        ball.y - py,
        (ball.vx - paddle.vx) * remaining,
        (ball.vy - paddle.vy) * remaining,
        paddle.r + CONFIG.BALL_R,
      );
      if (t >= 0 && t < bestT) { bestT = t; hitPaddle = paddle; wall = 0; }
    }

    const dt = remaining * bestT;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    elapsed += dt;
    remaining -= dt;

    if (hitPaddle) {
      resolveHit(game, hitPaddle, ball.x, ball.y);
    } else if (wall !== 0) {
      ball.x = wall < 0 ? left : right;
      ball.vx = -ball.vx * CONFIG.WALL_DAMPING;
      ball.spin *= 0.5;
      game.rallySpeed *= CONFIG.WALL_DAMPING;
      spawnWallParticles(game.fx, ball.x, ball.y, -wall);
      sfx.wall();
    } else {
      break;
    }
  }

  ball.x = clamp(ball.x, left, right);
}

// ---------------------------------------------------------------- счёт и матч

function scorePoint(game, side) {
  game.score[side]++;
  flashScore(game.fx, side);
  sfx.point(side === 'player');
  game.state = STATE.POINT;
  game.timer = CONFIG.POINT_DELAY;
  game.onPoint?.(side);

  const { player, ai } = game.score;
  const target = CONFIG.MATCH_POINTS;
  if ((player >= target || ai >= target) && Math.abs(player - ai) >= 2) {
    game.matchOver = true;
    game.winner = player > ai ? 'player' : 'ai';
  }
}

function endMatch(game) {
  game.state = STATE.OVER;
  if (game.winner === 'player') sfx.win();
  else sfx.lose();
  game.onMatchEnd?.(game.winner);
}

// Переигровка последнего очка после просмотра рекламы (§ 4.5).
export function replayLastPoint(game) {
  if (game.winner !== 'ai') return;
  game.score.ai = Math.max(0, game.score.ai - 1);
  game.matchOver = false;
  game.winner = null;
  game.rewardUsed = true;
  resetPaddles(game);
  beginServe(game);
}

// ---------------------------------------------------------------- цикл обновления

export function updateGame(game, frameDt) {
  const dt = Math.min(frameDt, CONFIG.MAX_DT);
  updateEffects(game.fx, dt);

  if (game.state === STATE.PAUSE || game.state === STATE.MENU || game.state === STATE.OVER) {
    return;
  }

  let left = dt;
  while (left > 1e-6) {
    const h = Math.min(CONFIG.PHYS_STEP, left);
    left -= h;
    physicsStep(game, h);
  }
}

function physicsStep(game, h) {
  const p = game.player;
  const a = game.ai;

  p.px = p.x; p.py = p.y;
  a.px = a.x; a.py = a.y;

  updatePlayer(game, h);
  updateAi(game, h);

  syncPaddleVelocity(p, h);
  syncPaddleVelocity(a, h);

  if (p.cooldown > 0) p.cooldown -= h;
  if (a.cooldown > 0) a.cooldown -= h;

  if (game.state === STATE.SERVE) {
    placeBallOnServer(game);
    game.timer -= h;
    if (game.timer <= 0) launchServe(game);
    return;
  }

  if (game.state === STATE.POINT) {
    // Мяч продолжает улетать за стол — очко не «замораживает» картинку.
    game.ball.x += game.ball.vx * h;
    game.ball.y += game.ball.vy * h;
    game.timer -= h;
    if (game.timer <= 0) {
      if (game.matchOver) endMatch(game);
      else beginServe(game);
    }
    return;
  }

  if (game.state !== STATE.RALLY) return;

  stepBall(game, h);

  game.trail.push(game.ball.x, game.ball.y);
  if (game.trail.length > CONFIG.TRAIL_LEN * 2) game.trail.splice(0, 2);

  if (game.ball.y < TABLE.top - CONFIG.OUT_MARGIN) scorePoint(game, 'player');
  else if (game.ball.y > TABLE.bottom + CONFIG.OUT_MARGIN) scorePoint(game, 'ai');
}

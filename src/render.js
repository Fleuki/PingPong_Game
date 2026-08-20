// Вся графика рисуется кодом на канвасе: никаких внешних картинок и шрифтов (п. 12).

import { CONFIG, TABLE, COLORS } from './config.js';
import { STATE } from './game.js';
import { t } from './i18n.js';

export function createView(canvas) {
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    dpr: 1,
    width: 0,   // ширина в CSS-пикселях
    height: 0,
    scale: 1,   // логическая единица -> CSS-пиксель
    offsetX: 0,
    offsetY: 0,
    pillR: 0,
    scorePill: { x: 0, y: 0, r: 0 },
    pausePill: { x: 0, y: 0, r: 0 },
  };
}

// § 1.10 — вписываем поле целиком (contain), ничего не обрезая.
export function resizeView(view) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const width = view.canvas.clientWidth || window.innerWidth;
  const height = view.canvas.clientHeight || window.innerHeight;

  view.dpr = dpr;
  view.width = width;
  view.height = height;
  view.canvas.width = Math.round(width * dpr);
  view.canvas.height = Math.round(height * dpr);

  view.scale = Math.min(width / CONFIG.FIELD.W, height / CONFIG.FIELD.H);
  view.offsetX = (width - CONFIG.FIELD.W * view.scale) / 2;
  view.offsetY = (height - CONFIG.FIELD.H * view.scale) / 2;

  // «Таблетки» счёта и паузы прижаты к краям поля, но не выходят за экран.
  const r = Math.max(38, Math.min(78 * view.scale, height * 0.1));
  view.pillR = r;
  const scoreX = Math.max(0, view.offsetX - r * 0.55);
  const pauseX = Math.min(width, width - view.offsetX + r * 0.55);
  // shift — сдвиг текста в видимую часть «таблетки», если она заходит за край экрана.
  view.scorePill = {
    x: scoreX, y: height / 2, r,
    shift: (Math.max(0, scoreX - r) + scoreX + r) / 2 - scoreX,
  };
  view.pausePill = {
    x: pauseX, y: height / 2, r,
    shift: (pauseX - r + Math.min(width, pauseX + r)) / 2 - pauseX,
  };
}

export function toLogicalX(view, screenX) {
  return (screenX - view.offsetX) / view.scale;
}

export function toLogicalY(view, screenY) {
  return (screenY - view.offsetY) / view.scale;
}

export function hitsPill(pill, x, y) {
  return Math.hypot(x - pill.x, y - pill.y) <= pill.r;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTable(ctx) {
  const { X, Y, W, H } = CONFIG.TABLE;
  const o = CONFIG.OUTLINE;

  ctx.fillStyle = COLORS.table;
  ctx.fillRect(X, Y, W, H);

  ctx.lineWidth = o;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineJoin = 'miter';
  ctx.strokeRect(X, Y, W, H);

  // Продольная центральная линия.
  ctx.fillStyle = COLORS.line;
  ctx.fillRect(TABLE.cx - 6, Y + o / 2, 12, H - o);

  // Сетка: белая полоса с чёрной жилкой.
  ctx.fillRect(X + o / 2, TABLE.net - 9, W - o, 18);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(X + o / 2, TABLE.net - 2, W - o, 4);
}

function drawShadow(ctx, x, y, r) {
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.arc(x + 12, y + 14, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawPaddle(ctx, paddle, color) {
  const r = paddle.r;
  const dir = paddle.isPlayer ? 1 : -1; // куда смотрит ручка
  const o = CONFIG.OUTLINE;

  ctx.save();
  ctx.translate(paddle.x, paddle.y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.lineWidth = o;
  ctx.strokeStyle = COLORS.ink;

  // Ручка.
  const hw = r * 0.32;
  const hl = r * 1.15;
  ctx.fillStyle = color;
  const hy = dir > 0 ? r * 0.45 : -r * 0.45 - hl;
  roundedRect(ctx, -hw / 2, hy, hw, hl, hw * 0.25);
  ctx.fill();
  ctx.stroke();

  // Голова ракетки.
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Светлая накладка со стороны стола.
  ctx.save();
  ctx.clip();
  const edge = -dir * r * 0.66;
  ctx.fillStyle = COLORS.line;
  if (dir > 0) ctx.fillRect(-r, -r, r * 2, r + edge);
  else ctx.fillRect(-r, edge, r * 2, r - edge);
  ctx.restore();

  ctx.lineWidth = o * 0.7;
  ctx.beginPath();
  ctx.moveTo(-r * 0.84, edge);
  ctx.lineTo(r * 0.84, edge);
  ctx.stroke();

  ctx.lineWidth = o;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTrail(ctx, trail) {
  const points = trail.length / 2;
  for (let i = 0; i < points; i++) {
    const k = (i + 1) / points;
    ctx.globalAlpha = 0.22 * k;
    ctx.fillStyle = COLORS.line;
    ctx.beginPath();
    ctx.arc(trail[i * 2], trail[i * 2 + 1], CONFIG.BALL_R * 0.9 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBall(ctx, ball) {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, CONFIG.BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.ball;
  ctx.fill();
  ctx.lineWidth = CONFIG.OUTLINE * 0.8;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    const k = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.size * k);
    ctx.lineTo(p.size * k, p.size * k);
    ctx.lineTo(-p.size * k, p.size * k);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPill(ctx, pill, draw) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(pill.x, pill.y, pill.r, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.line;
  ctx.fill();
  ctx.save();
  ctx.translate(pill.x, pill.y);
  ctx.rotate(-Math.PI / 2);
  // После поворота локальная ось X смотрит вверх экрана, ось Y — вправо.
  draw(ctx, pill.r, pill.shift);
  ctx.restore();
  ctx.restore();
}

function drawHud(view, game) {
  const ctx = view.ctx;
  const flash = game.fx.flash;

  drawPill(ctx, view.scorePill, (c, r, shift) => {
    const size = Math.round(r * 0.5);
    c.font = `bold ${size}px "Trebuchet MS", Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const left = String(game.score.player);
    const right = String(game.score.ai);
    const colon = ':';
    const wl = c.measureText(left).width;
    const wr = c.measureText(right).width;
    const wc = c.measureText(colon).width;
    const total = wl + wc + wr;
    let x = -total / 2;
    c.fillStyle = COLORS.player;
    c.fillText(left, x + wl / 2, shift);
    x += wl;
    c.fillStyle = COLORS.ink;
    c.fillText(colon, x + wc / 2, shift);
    x += wc;
    c.fillStyle = COLORS.ai;
    c.fillText(right, x + wr / 2, shift);
  });

  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash * 0.5;
    ctx.fillStyle = game.fx.flashSide === 'player' ? COLORS.player : COLORS.ai;
    ctx.beginPath();
    ctx.arc(view.scorePill.x, view.scorePill.y, view.scorePill.r * (1 + flash * 0.25), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPill(ctx, view.pausePill, (c, r, shift) => {
    c.font = `bold ${Math.round(r * 0.3)}px "Trebuchet MS", Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = COLORS.ink;
    c.fillText(t('hud.pause'), 0, shift);
  });
}

export function render(view, game) {
  const ctx = view.ctx;
  const { dpr, scale, offsetX, offsetY } = view;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, view.width, view.height);

  ctx.save();
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offsetX * dpr, offsetY * dpr);

  drawTable(ctx);

  const showBall = game.state !== STATE.MENU && game.state !== STATE.OVER;
  if (showBall) drawShadow(ctx, game.ball.x, game.ball.y, CONFIG.BALL_R);
  drawShadow(ctx, game.player.x, game.player.y, game.player.r);
  drawShadow(ctx, game.ai.x, game.ai.y, game.ai.r);

  if (showBall) drawTrail(ctx, game.trail);

  drawPaddle(ctx, game.ai, COLORS.ai);
  drawPaddle(ctx, game.player, COLORS.player);
  if (showBall) drawBall(ctx, game.ball);
  drawParticles(ctx, game.fx.particles);

  ctx.restore();

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (game.state !== STATE.MENU) drawHud(view, game);
}

// Частицы удара и вспышка счёта (дизайн-документ, п. 12).

import { COLORS } from './config.js';

export function createEffects() {
  return { particles: [], flash: 0, flashSide: 'player' };
}

export function spawnHitParticles(fx, x, y, dirY, color) {
  const count = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const angle = (-Math.PI / 2) * (dirY > 0 ? -1 : 1) + (Math.random() - 0.5) * 1.9;
    const speed = 220 + Math.random() * 260;
    fx.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.2,
      maxLife: 0.2,
      size: 10 + Math.random() * 8,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 12,
      color: color || COLORS.ink,
    });
  }
}

export function spawnWallParticles(fx, x, y, dirX) {
  for (let i = 0; i < 4; i++) {
    const angle = (dirX > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.4;
    const speed = 160 + Math.random() * 160;
    fx.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.16,
      maxLife: 0.16,
      size: 8 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 10,
      color: COLORS.line,
    });
  }
}

export function flashScore(fx, side) {
  fx.flash = 1;
  fx.flashSide = side;
}

export function updateEffects(fx, dt) {
  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) { fx.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.rot += p.spin * dt;
  }
  if (fx.flash > 0) fx.flash = Math.max(0, fx.flash - dt * 1.6);
}

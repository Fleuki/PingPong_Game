// Управление: палец в нижней половине экрана, мышь или клавиатура (п. 4).

import { TABLE } from './config.js';
import { toLogicalX, toLogicalY, hitsPill } from './render.js';

export function attachInput(canvas, view, game, hooks) {
  const input = game.input;
  let pointerId = null;

  const controllable = () => hooks.isPlayable();

  function screenPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function aim(point) {
    input.x = toLogicalX(view, point.x);
    input.y = Math.max(TABLE.net + 45, toLogicalY(view, point.y));
    input.active = true;
  }

  canvas.addEventListener('pointerdown', (event) => {
    const point = screenPoint(event);
    hooks.onFirstInput?.();

    if (hitsPill(view.pausePill, point.x, point.y)) {
      hooks.onPauseButton();
      return;
    }
    if (!controllable()) return;
    // Нижняя половина экрана — зона управления ракеткой.
    if (toLogicalY(view, point.y) < TABLE.net) return;

    pointerId = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    aim(point);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!controllable()) return;
    const point = screenPoint(event);
    if (pointerId === event.pointerId) {
      aim(point);
      return;
    }
    // Мышь ведёт ракетку без нажатия, пока курсор в нижней половине.
    if (event.pointerType === 'mouse' && pointerId === null && toLogicalY(view, point.y) >= TABLE.net) {
      aim(point);
    }
  });

  const release = (event) => {
    if (pointerId === event.pointerId) {
      canvas.releasePointerCapture?.(event.pointerId);
      pointerId = null;
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const keyMap = {
    ArrowLeft: ['keyX', -1], KeyA: ['keyX', -1],
    ArrowRight: ['keyX', 1], KeyD: ['keyX', 1],
    ArrowUp: ['keyY', -1], KeyW: ['keyY', -1],
    ArrowDown: ['keyY', 1], KeyS: ['keyY', 1],
  };

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' || event.code === 'KeyP') {
      hooks.onPauseButton();
      return;
    }
    const bind = keyMap[event.code];
    if (!bind) return;
    event.preventDefault();
    hooks.onFirstInput?.();
    if (!controllable()) return;
    input[bind[0]] = bind[1];
    input.active = true;
  });

  window.addEventListener('keyup', (event) => {
    const bind = keyMap[event.code];
    if (!bind) return;
    if (input[bind[0]] === bind[1]) input[bind[0]] = 0;
  });

  window.addEventListener('blur', () => {
    input.keyX = 0;
    input.keyY = 0;
    pointerId = null;
  });
}

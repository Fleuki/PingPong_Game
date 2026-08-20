// Точка входа: запуск цикла, связка интерфейса, ввода и Yandex Games SDK.

import { CONFIG } from './config.js';
import { createGame, updateGame, startMatch, replayLastPoint, STATE } from './game.js';
import { createView, resizeView, render } from './render.js';
import { attachInput } from './input.js';
import { createUi } from './ui.js';
import { detectLanguage, applyLanguage } from './i18n.js';
import { loadProgress, save, persist } from './storage.js';
import { pauseAllAudio, resumeAllAudio, setSoundEnabled, isSoundEnabled, unlockAudio } from './audio.js';
import {
  sdk, initSdk, reportGameReady, gameplayStart, gameplayStop,
  showInterstitial, showRewarded, canShowInterstitial,
} from './sdk.js';

// § 1.6 — никакого выделения, контекстного меню и жестов масштабирования в игре.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

const canvas = document.getElementById('game');
const view = createView(canvas);
const game = createGame();

const isPlaying = () =>
  game.state === STATE.SERVE || game.state === STATE.RALLY || game.state === STATE.POINT;

const ui = createUi({
  play: () => beginMatch(),
  again: () => withInterstitial(() => beginMatch()),
  restart: () => beginMatch(),
  resume: () => resumeGame(),
  toMenu: () => withInterstitial(() => toMenu()),
  watchReward: () => watchReward(),
  canReward: () => !!sdk.ysdk,
});

function beginMatch() {
  startMatch(game, save.difficulty);
  ui.hide();
  gameplayStart();
}

function toMenu() {
  game.state = STATE.MENU;
  gameplayStop();
  ui.show('menu');
}

function pauseGame() {
  if (!isPlaying()) return;
  game.prevState = game.state;
  game.state = STATE.PAUSE;
  gameplayStop();
  pauseAllAudio();
  ui.show('pause');
}

function resumeGame() {
  if (game.state !== STATE.PAUSE) return;
  game.state = game.prevState;
  ui.hide();
  if (isSoundEnabled()) resumeAllAudio();
  gameplayStart();
}

function togglePause() {
  if (game.state === STATE.PAUSE) resumeGame();
  else if (isPlaying()) pauseGame();
}

// § 4.4 — межстраничная реклама только между матчами, в логической паузе.
function withInterstitial(next) {
  if (!sdk.ysdk || !canShowInterstitial()) {
    next();
    return;
  }
  showInterstitial(next);
}

// § 4.5 — награда только по явному нажатию игрока на кнопку.
function watchReward() {
  if (game.winner !== 'ai' || game.rewardUsed) return;
  showRewarded(
    () => { game.rewardUsed = true; },
    (rewarded) => {
      if (rewarded) {
        replayLastPoint(game);
        ui.hide();
        gameplayStart();
      } else {
        ui.showOver(game);
      }
    },
  );
}

game.onMatchEnd = (winner) => {
  gameplayStop();
  if (winner === 'player') {
    save.wins[game.difficulty] = (save.wins[game.difficulty] || 0) + 1;
  }
  if (game.bestRallyInMatch > save.bestRally) save.bestRally = game.bestRallyInMatch;
  persist();
  ui.showOver(game);
};

attachInput(canvas, view, game, {
  isPlayable: () => isPlaying(),
  onPauseButton: () => togglePause(),
  onFirstInput: () => unlockAudio(),
});

// § 1.3 — звук и геймплей паузятся при потере фокуса страницы.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseAllAudio();
    pauseGame();
  } else if (isSoundEnabled() && game.state !== STATE.PAUSE) {
    resumeAllAudio();
  }
});
window.addEventListener('blur', () => { pauseAllAudio(); pauseGame(); });
window.addEventListener('focus', () => { if (isSoundEnabled() && game.state !== STATE.PAUSE) resumeAllAudio(); });

// Реклама: звук молчит на время ролика (§ 4.7).
sdk.onAdStart = () => pauseAllAudio();
sdk.onAdEnd = () => { if (isSoundEnabled() && game.state !== STATE.PAUSE) resumeAllAudio(); };

function onResize() {
  resizeView(view);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

// Отладочный доступ к состоянию только по ?debug — в обычном запуске ничего не публикуется.
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = game;
  window.__view = view;
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, CONFIG.MAX_DT);
  lastTime = now;
  updateGame(game, dt);
  render(view, game);
  requestAnimationFrame(loop);
}

// Ни один внешний вызов не должен подвесить загрузку игры (§ 1.14).
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function boot() {
  resizeView(view);
  requestAnimationFrame(loop);

  await withTimeout(initSdk(), 6000);
  detectLanguage(sdk.lang);
  applyLanguage();

  await withTimeout(loadProgress(), 4000);
  setSoundEnabled(save.sound);

  ui.show('menu');
  reportGameReady(); // § 1.19.2 — игра готова к игре
}

boot().catch((err) => {
  console.error(err);
  applyLanguage();
  ui.show('menu');
  reportGameReady();
});

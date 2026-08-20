// Интеграция с Yandex Games SDK (§ 1.1, § 1.19.2, § 2.14, § 4.4–4.7, § 1.9).
// Все вызовы безопасны и без SDK: локально игра работает на заглушках.

import { CONFIG } from './config.js';

export const sdk = {
  ready: false,
  ysdk: null,
  player: null,
  lang: 'ru',
  lastInterstitial: 0,
  // Хуки выставляет игра: пауза звука и остановка геймплея на время рекламы.
  onAdStart: () => {},
  onAdEnd: () => {},
};

let loadingReported = false;
let gameplayActive = false;

export async function initSdk() {
  if (typeof YaGames === 'undefined') {
    console.info('Yandex Games SDK недоступен, игра запущена локально.');
    return null;
  }
  try {
    const ysdk = await YaGames.init();
    sdk.ysdk = ysdk;
    sdk.ready = true;
    sdk.lang = ysdk?.environment?.i18n?.lang || 'ru';
    try {
      sdk.player = await ysdk.getPlayer({ scopes: false });
    } catch (err) {
      sdk.player = null; // игрок не авторизован — работаем через localStorage
    }
    return ysdk;
  } catch (err) {
    console.error('Не удалось инициализировать Yandex Games SDK', err);
    return null;
  }
}

// § 1.19.2 — Game Ready API: игра действительно готова к игре.
export function reportGameReady() {
  if (loadingReported) return;
  loadingReported = true;
  try {
    sdk.ysdk?.features?.LoadingAPI?.ready();
  } catch (err) {
    console.error(err);
  }
}

export function gameplayStart() {
  if (gameplayActive) return;
  gameplayActive = true;
  try {
    sdk.ysdk?.features?.GameplayAPI?.start();
  } catch (err) {
    console.error(err);
  }
}

export function gameplayStop() {
  if (!gameplayActive) return;
  gameplayActive = false;
  try {
    sdk.ysdk?.features?.GameplayAPI?.stop();
  } catch (err) {
    console.error(err);
  }
}

export function canShowInterstitial() {
  const now = performance.now() / 1000;
  return now - sdk.lastInterstitial >= CONFIG.AD_INTERSTITIAL_INTERVAL;
}

// § 4.4 — только в логической паузе: между матчами, никогда во время розыгрыша.
export function showInterstitial(onDone) {
  const finish = () => {
    sdk.onAdEnd();
    onDone?.();
  };
  if (!sdk.ysdk?.adv || !canShowInterstitial()) {
    onDone?.();
    return;
  }
  sdk.lastInterstitial = performance.now() / 1000;
  gameplayStop();
  sdk.onAdStart();
  try {
    sdk.ysdk.adv.showFullscreenAdv({
      callbacks: { onClose: finish, onError: finish },
    });
  } catch (err) {
    console.error(err);
    finish();
  }
}

// § 4.5 — только по явному нажатию игрока на кнопку.
export function showRewarded(onReward, onDone) {
  let rewarded = false;
  const finish = () => {
    sdk.onAdEnd();
    onDone?.(rewarded);
  };
  if (!sdk.ysdk?.adv) {
    // Без SDK (локальный запуск) награда не выдаётся.
    onDone?.(false);
    return;
  }
  gameplayStop();
  sdk.onAdStart();
  try {
    sdk.ysdk.adv.showRewardedVideo({
      callbacks: {
        onRewarded: () => { rewarded = true; onReward?.(); },
        onClose: finish,
        onError: finish,
      },
    });
  } catch (err) {
    console.error(err);
    finish();
  }
}

// § 1.9 — облачные сохранения с фоллбэком на localStorage.
export async function loadCloudData() {
  if (!sdk.player) return null;
  try {
    return await sdk.player.getData();
  } catch (err) {
    return null;
  }
}

export function saveCloudData(data) {
  if (!sdk.player) return;
  try {
    sdk.player.setData(data, false)?.catch?.(() => {});
  } catch (err) {
    /* тихо игнорируем: локальная копия уже сохранена */
  }
}

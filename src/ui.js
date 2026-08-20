// Экраны меню, паузы и конца матча — DOM-оверлеи поверх канваса (п. 8).

import { DIFFICULTY_ORDER } from './config.js';
import { t } from './i18n.js';
import { save, persist } from './storage.js';
import { isSoundEnabled, setSoundEnabled, sfx, unlockAudio } from './audio.js';

const SCREENS = ['menu', 'howto', 'pause', 'over'];

export function createUi(actions) {
  const el = {
    menu: document.getElementById('screen-menu'),
    howto: document.getElementById('screen-howto'),
    pause: document.getElementById('screen-pause'),
    over: document.getElementById('screen-over'),
    menuStats: document.getElementById('menu-stats'),
    overTitle: document.getElementById('over-title'),
    overScore: document.getElementById('over-score'),
    overStats: document.getElementById('over-stats'),
    sound: document.getElementById('btn-sound'),
    reward: document.getElementById('btn-reward'),
  };

  const ui = {
    current: null,
    show(name) {
      ui.current = name;
      for (const key of SCREENS) el[key].hidden = key !== name;
      if (name === 'menu') ui.refreshMenu();
    },
    hide() {
      ui.current = null;
      for (const key of SCREENS) el[key].hidden = true;
    },
    refreshMenu() {
      el.menuStats.textContent =
        t('statsBest', { n: save.bestRally }) + '\n' +
        t('statsWins', { easy: save.wins.easy, normal: save.wins.normal, hard: save.wins.hard });
      refreshDifficulty();
      refreshSound();
    },
    showOver(game) {
      el.overTitle.textContent = game.winner === 'player' ? t('win') : t('lose');
      el.overScore.textContent = `${game.score.player} : ${game.score.ai}`;
      el.overStats.textContent = t('statsRally', { n: game.bestRallyInMatch });
      el.reward.hidden = !(game.winner === 'ai' && !game.rewardUsed && actions.canReward());
      ui.show('over');
    },
  };

  function refreshDifficulty() {
    document.querySelectorAll('[data-difficulty]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.difficulty === save.difficulty));
    });
  }

  function refreshSound() {
    el.sound.textContent = isSoundEnabled() ? t('soundOn') : t('soundOff');
  }

  function bind(id, handler) {
    document.getElementById(id).addEventListener('click', () => {
      unlockAudio();
      sfx.ui();
      handler();
    });
  }

  bind('btn-play', () => actions.play());
  bind('btn-howto', () => ui.show('howto'));
  bind('btn-howto-back', () => ui.show('menu'));
  bind('btn-resume', () => actions.resume());
  bind('btn-restart', () => actions.restart());
  bind('btn-tomenu', () => actions.toMenu());
  bind('btn-again', () => actions.again());
  bind('btn-over-menu', () => actions.toMenu());
  bind('btn-reward', () => actions.watchReward());
  bind('btn-sound', () => {
    setSoundEnabled(!isSoundEnabled());
    save.sound = isSoundEnabled();
    persist();
    refreshSound();
  });

  document.querySelectorAll('[data-difficulty]').forEach((btn) => {
    btn.addEventListener('click', () => {
      unlockAudio();
      sfx.ui();
      const value = btn.dataset.difficulty;
      if (!DIFFICULTY_ORDER.includes(value)) return;
      save.difficulty = value;
      persist();
      refreshDifficulty();
    });
  });

  return ui;
}

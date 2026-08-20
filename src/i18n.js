// § 2.14 — язык интерфейса определяется платформой через ysdk.environment.i18n.lang.
// Игра выпускается только на русском, поэтому любой другой язык откатывается на русский.

const SUPPORTED = ['ru'];
const FALLBACK = 'ru';

const STRINGS = {
  ru: {
    title: 'Кручёный удар',
    tagline: 'Настольный теннис с подкруткой. Матч до 11 очков.',
    play: 'Играть',
    difficulty: 'Сложность',
    diffEasy: 'Лёгкий',
    diffNormal: 'Средний',
    diffHard: 'Сложный',
    howto: 'Как играть',
    howtoTitle: 'Как играть',
    howtoBody:
      'Ведите ракетку пальцем в нижней половине экрана. На компьютере — мышью или клавишами со стрелками и A/D.\n\n' +
      'Важно не просто дотянуться до мяча, а ударить по нему. Край ракетки отправляет мяч вбок, ' +
      'движение навстречу добавляет силы, а боковое движение в момент удара закручивает мяч, и он летит по дуге.\n\n' +
      'С каждым ударом розыгрыш ускоряется. Матч идёт до 11 очков, при счёте 10:10 — до разницы в два очка.',
    back: 'Назад',
    pauseTitle: 'Пауза',
    resume: 'Продолжить',
    restart: 'Начать заново',
    toMenu: 'В меню',
    again: 'Ещё раз',
    win: 'Победа',
    lose: 'Поражение',
    rewardBtn: 'Смотреть рекламу и переиграть очко',
    soundOn: 'Звук: включён',
    soundOff: 'Звук: выключен',
    hud: { pause: 'ПАУЗА' },
    statsBest: 'Лучшая серия ударов: {n}',
    statsWins: 'Побед: лёгкий {easy} · средний {normal} · сложный {hard}',
    statsRally: 'Самая длинная серия в матче: {n}',
  },
};

let current = FALLBACK;

export function detectLanguage(sdkLang) {
  const lang = String(sdkLang || '').slice(0, 2).toLowerCase();
  current = SUPPORTED.includes(lang) ? lang : FALLBACK;
  document.documentElement.lang = current;
  return current;
}

export function t(key, params) {
  const parts = key.split('.');
  let value = STRINGS[current] || STRINGS[FALLBACK];
  for (const part of parts) value = value && value[part];
  if (typeof value !== 'string') return key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (m, name) => (name in params ? params[name] : m));
}

// Подставляет тексты во все элементы с data-i18n.
export function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}

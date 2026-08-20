// Все параметры баланса и геометрии — в одном месте (см. дизайн-документ, п. 5.4).

export const CONFIG = {
  // Логическое поле. Канвас вписывается в экран по min(scaleX, scaleY) — contain.
  FIELD: { W: 600, H: 1000 },

  // Стол внутри логического поля.
  TABLE: { X: 80, Y: 120, W: 440, H: 760 },

  BALL_R: 30,
  PADDLE_R: 62,
  OUTLINE: 12,

  // Физика с фиксированным шагом (п. 5.5).
  PHYS_STEP: 1 / 120,
  MAX_DT: 1 / 30,

  BASE_SPEED: 550,      // ед/сек, скорость подачи
  MAX_SPEED: 1400,
  SPEED_STEP: 1.02,     // разгон за каждый удар
  MAX_ANGLE_SPEED: 420, // вклад точки попадания в горизонтальную скорость
  MIN_VY: 240,          // мяч всегда летит к сопернику, а не вдоль сетки
  POWER_FACTOR: 0.35,   // вклад скорости ракетки в силу удара

  // Подкрутка: spin нормирован к диапазону примерно [-1, 1].
  SPIN_FACTOR: 0.8,     // множитель бокового движения ракетки
  SPIN_REF: 900,        // скорость ракетки, дающая максимальную подкрутку
  SPIN_FORCE: 320,      // ед/сек² искривления траектории при spin = 1
  SPIN_DECAY: 0.99,     // затухание за один шаг физики
  SPIN_MAX: 1.2,

  WALL_DAMPING: 0.95,   // потеря скорости при отскоке от боковой линии
  PADDLE_LERP: 0.3,     // сглаживание движения ракетки игрока (за кадр при 60 Гц)
  PADDLE_MAX_SPEED: 2600, // предел скорости ракетки игрока, ед/сек

  SERVE_DELAY: 0.6,     // пауза перед подачей, сек
  POINT_DELAY: 0.75,    // пауза после очка, сек
  OUT_MARGIN: 150,      // насколько мяч должен уйти за край стола, чтобы засчитать очко

  MATCH_POINTS: 11,
  TRAIL_LEN: 16,
  HIT_COOLDOWN: 0.05,

  AD_INTERSTITIAL_INTERVAL: 185, // сек между межстраничными роликами (лимит платформы — 180)
};

// Производные величины стола.
export const TABLE = {
  left: CONFIG.TABLE.X,
  right: CONFIG.TABLE.X + CONFIG.TABLE.W,
  top: CONFIG.TABLE.Y,
  bottom: CONFIG.TABLE.Y + CONFIG.TABLE.H,
  cx: CONFIG.TABLE.X + CONFIG.TABLE.W / 2,
  net: CONFIG.TABLE.Y + CONFIG.TABLE.H / 2,
};

export const DIFFICULTY = {
  easy:   { error: 140, speed: 380, reaction: 0.32, readSpin: false },
  normal: { error: 70,  speed: 520, reaction: 0.18, readSpin: true },
  hard:   { error: 25,  speed: 700, reaction: 0.09, readSpin: true },
};

export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

export const COLORS = {
  bg: '#f2c662',
  bgShade: '#e8ba52',
  table: '#6ed22e',
  tableShade: '#5cb827',
  ink: '#101010',
  line: '#ffffff',
  player: '#ef4050',
  ai: '#23d3f5',
  ball: '#ffffff',
  shadow: 'rgba(0, 0, 0, 0.16)',
};

// Общая утилита: используется и в физике, и в ИИ.
export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

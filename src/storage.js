// Прогресс и настройки (дизайн-документ, п. 9).
// Облачные сохранения Yandex Games с фоллбэком на localStorage.

import { loadCloudData, saveCloudData } from './sdk.js';

const KEY = 'krucheny-udar-save-v1';

const DEFAULTS = {
  difficulty: 'normal',
  sound: true,
  bestRally: 0,
  wins: { easy: 0, normal: 0, hard: 0 },
};

export const save = { ...DEFAULTS, wins: { ...DEFAULTS.wins } };

let saveTimer = 0;

function merge(data) {
  if (!data || typeof data !== 'object') return;
  if (typeof data.difficulty === 'string' && data.difficulty in DEFAULTS.wins) {
    save.difficulty = data.difficulty;
  }
  if (typeof data.sound === 'boolean') save.sound = data.sound;
  if (Number.isFinite(data.bestRally)) save.bestRally = Math.max(0, Math.floor(data.bestRally));
  if (data.wins && typeof data.wins === 'object') {
    for (const key of Object.keys(DEFAULTS.wins)) {
      if (Number.isFinite(data.wins[key])) save.wins[key] = Math.max(0, Math.floor(data.wins[key]));
    }
  }
}

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (err) {
    return null;
  }
}

function writeLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (err) {
    /* приватный режим браузера — просто играем без сохранения */
  }
}

export async function loadProgress() {
  merge(readLocal());
  const cloud = await loadCloudData();
  if (cloud) merge(cloud);
  return save;
}

export function persist() {
  writeLocal();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveCloudData({ ...save }), 400);
}

// Сборка игры в один HTML-файл: модули склеиваются в одну область видимости,
// стили встраиваются в <style>. Нужно для превью по ссылке и для быстрой раздачи
// сборки, где нельзя отдать несколько файлов.
//
//   node tools/bundle.mjs                 -> dist/krucheny-udar.html
//   node tools/bundle.mjs --no-sdk        -> без внешнего скрипта Yandex Games SDK
//
// Основная сборка для Яндекс Игр — обычные файлы репозитория, этот бандл её не заменяет.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Порядок важен: модуль должен идти после тех, чьи значения он читает при загрузке.
const MODULES = [
  'config', 'i18n', 'effects', 'sdk', 'storage', 'audio',
  'ai', 'game', 'render', 'input', 'ui', 'main',
];

const noSdk = process.argv.includes('--no-sdk');

const IMPORT_RE = /^import\s+[^;]*?from\s+'[^']*';\s*$/gm;
const EXPORT_RE = /^export\s+(?=const|let|var|function|async|class)/gm;
const DECL_RE = /^(?:export\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;

const seen = new Map();
const chunks = [];

for (const name of MODULES) {
  const file = resolve(root, 'src', `${name}.js`);
  const source = readFileSync(file, 'utf8');

  // Имена верхнего уровня склеиваются в одну область видимости — проверяем конфликты.
  for (const match of source.matchAll(DECL_RE)) {
    const id = match[1];
    if (seen.has(id)) {
      throw new Error(`Конфликт имён: «${id}» объявлен и в ${seen.get(id)}.js, и в ${name}.js`);
    }
    seen.set(id, name);
  }

  const body = source.replace(IMPORT_RE, '').replace(EXPORT_RE, '').trim();
  chunks.push(`// ---- src/${name}.js ----\n${body}`);
}

const css = readFileSync(resolve(root, 'styles.css'), 'utf8').trim();
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

// Из index.html берём только содержимое <body> без подключения модуля.
const bodyMatch = html.match(/<body>([\s\S]*?)<script type="module"/);
if (!bodyMatch) throw new Error('Не удалось вырезать разметку из index.html');
const markup = bodyMatch[1].trim();

const title = (html.match(/<title>([^<]*)<\/title>/) || [, 'Кручёный удар'])[1];
const sdkTag = noSdk ? '' : '<script src="https://yandex.ru/games/sdk/v2"></script>\n';

const out = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${title}</title>
<style>
${css}
</style>
${sdkTag}</head>
<body>
${markup}
<script>
(() => {
'use strict';
${chunks.join('\n\n')}
})();
</script>
</body>
</html>
`;

mkdirSync(resolve(root, 'dist'), { recursive: true });
const target = resolve(root, 'dist', 'krucheny-udar.html');
writeFileSync(target, out, 'utf8');
console.log(`${target} — ${(Buffer.byteLength(out) / 1024).toFixed(1)} КБ${noSdk ? ' (без SDK)' : ''}`);

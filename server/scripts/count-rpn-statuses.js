/**
 * Подсчёт распределения значений поля `status` в выгрузке РПН JSON.
 *
 * Запуск:
 *   node scripts/count-rpn-statuses.js /path/to/licenses.json
 *   node scripts/count-rpn-statuses.js /path/to/licenses.json --json-path=content.*
 *   node scripts/count-rpn-statuses.js /path/to/licenses.json --json-path=*.content.*
 *
 * Считает:
 * - общее число записей
 * - сколько status отсутствует/пустой
 * - сколько уникальных нормализованных status
 * - топ значений status по частоте
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const JSONStream = require('JSONStream');

function parseArgs(argv) {
  const positional = [];
  let jsonStreamPath = '';
  for (const a of argv) {
    if (a.startsWith('--json-path=')) jsonStreamPath = a.slice('--json-path='.length).trim();
    else if (!a.startsWith('-')) positional.push(a);
  }
  return { jsonPath: positional[0] ?? '', jsonStreamPath };
}

function detectJsonStreamPath(abs) {
  const fh = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.alloc(16384);
    const n = fs.readSync(fh, buf, 0, 16384, 0);
    let head = buf.subarray(0, n).toString('utf8').trimStart();
    if (head.charCodeAt(0) === 0xfeff) head = head.slice(1);
    if (head.startsWith('[')) return '*.content.*';
    return 'content.*';
  } finally {
    fs.closeSync(fh);
  }
}

function normalizeStatus(v) {
  if (v == null) return '';
  return String(v).trim().toLowerCase();
}

async function main() {
  const { jsonPath, jsonStreamPath } = parseArgs(process.argv.slice(2));
  if (!jsonPath) {
    console.error(
      'Укажите путь к JSON: node scripts/count-rpn-statuses.js <file.json> [--json-path=content.*]',
    );
    process.exit(1);
  }

  const abs = path.isAbsolute(jsonPath) ? jsonPath : path.resolve(process.cwd(), jsonPath);
  if (!fs.existsSync(abs)) {
    console.error('Файл не найден:', abs);
    process.exit(1);
  }

  const pattern = jsonStreamPath || detectJsonStreamPath(abs);
  console.log('JSONStream path:', pattern);

  const counts = new Map();
  let totalEntries = 0;
  let missingStatus = 0;

  const readStream = fs.createReadStream(abs, { encoding: 'utf8' });
  const parser = JSONStream.parse(pattern);

  await new Promise((resolve, reject) => {
    const fail = (err) => {
      readStream.destroy();
      reject(err);
    };

    readStream.on('error', fail);
    parser.on('error', fail);

    parser.on('data', (entry) => {
      totalEntries += 1;
      const statusNorm = normalizeStatus(entry?.status);
      if (!statusNorm) missingStatus += 1;
      const prev = counts.get(statusNorm) ?? 0;
      counts.set(statusNorm, prev + 1);
    });

    parser.on('end', () => resolve());
    readStream.pipe(parser);
  });

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const printable = sorted.map(([k, v]) => ({
    status: k || '(empty_or_missing)',
    count: v,
  }));

  const report = {
    totalEntries,
    uniqueStatuses: printable.length,
    missingOrEmptyStatus: missingStatus,
    statuses: printable,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('Ошибка подсчёта статусов:', e instanceof Error ? e.message : e);
  process.exit(1);
});

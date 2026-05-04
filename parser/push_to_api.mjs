#!/usr/bin/env node
/**
 * Стримит licenses.json (вывод parser/main.py), маппит каждую запись в snapshot
 * через server/rpnRegistryMap.js и отправляет батчами в /api/rpn-sync/upsert.
 *
 * Запуск:
 *   node parser/push_to_api.mjs <path/to/licenses.json>
 *
 * Переменные окружения (берутся из parser/.env через sync_rpn.sh):
 *   API_BASE_URL    — корень сервера (https://example.com).
 *   RPN_SYNC_TOKEN  — Bearer-токен для /api/rpn-sync/upsert.
 *   BATCH_SIZE      — строк в одном HTTP-запросе (по умолчанию 500, не больше 500).
 *   BATCH_DELAY_MS  — пауза между запросами (по умолчанию 700ms).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { extractSnapshot } from '../server/rpnRegistryMap.js';

const require = createRequire(import.meta.url);
const JSONStream = require('JSONStream');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node push_to_api.mjs <path/to/licenses.json>');
  process.exit(1);
}

const jsonPath = path.isAbsolute(args[0]) ? args[0] : path.resolve(process.cwd(), args[0]);
if (!fs.existsSync(jsonPath)) {
  console.error(`ERROR: файл не найден: ${jsonPath}`);
  process.exit(1);
}

const apiBase = String(process.env.API_BASE_URL ?? '').replace(/\/+$/, '');
const token = String(process.env.RPN_SYNC_TOKEN ?? '').trim();
const batchSize = Math.max(1, Math.min(Number(process.env.BATCH_SIZE) || 500, 500));
const batchDelayMs = Math.max(0, Number(process.env.BATCH_DELAY_MS) || 700);

if (!apiBase) {
  console.error('ERROR: API_BASE_URL не задан в окружении.');
  process.exit(1);
}
if (!token) {
  console.error('ERROR: RPN_SYNC_TOKEN не задан в окружении.');
  process.exit(1);
}

const upsertUrl = `${apiBase}/api/rpn-sync/upsert`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Определить путь JSONStream:
 *   - { "content": [...] } → "content.*"
 *   - [{ "content": [...] }, ...] → "*.content.*"
 */
function detectJsonStreamPath(abs) {
  const fh = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.alloc(16384);
    const n = fs.readSync(fh, buf, 0, 16384, 0);
    let head = buf.subarray(0, n).toString('utf8').trimStart();
    if (head.charCodeAt(0) === 0xfeff) head = head.slice(1);
    return head.startsWith('[') ? '*.content.*' : 'content.*';
  } finally {
    fs.closeSync(fh);
  }
}

let totalEntries = 0;
let totalSnapshots = 0;
let totalInserted = 0;
let totalUpdated = 0;
let totalSkipped = 0;
let batchesSent = 0;

async function postBatch(batch) {
  if (batch.length === 0) return;
  const body = JSON.stringify({ snapshots: batch });
  const res = await fetch(upsertUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status} from ${upsertUrl}: ${text.slice(0, 500)}`);
    throw new Error(`upsert HTTP ${res.status}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = {};
  }
  totalInserted += Number(json.inserted ?? 0);
  totalUpdated += Number(json.updated ?? 0);
  totalSkipped += Array.isArray(json.skipped) ? json.skipped.length : 0;
  batchesSent += 1;
  console.log(
    `batch #${batchesSent}: sent=${batch.length} inserted=${json.inserted ?? 0} updated=${json.updated ?? 0} skipped=${Array.isArray(json.skipped) ? json.skipped.length : 0}`,
  );
}

async function main() {
  const pattern = detectJsonStreamPath(jsonPath);
  console.log(`stream path: ${pattern}; batch=${batchSize}; delay=${batchDelayMs}ms`);

  const readStream = fs.createReadStream(jsonPath, { encoding: 'utf8' });
  const parser = JSONStream.parse(pattern);

  let buffer = [];
  /** @type {Promise<void>} */
  let chain = Promise.resolve();

  await new Promise((resolve, reject) => {
    const fail = (err) => {
      readStream.destroy();
      reject(err);
    };
    readStream.on('error', fail);
    parser.on('error', fail);

    parser.on('data', (entry) => {
      totalEntries += 1;
      const snap = extractSnapshot(entry);
      if (!snap) return;
      totalSnapshots += 1;
      buffer.push(snap);
      if (buffer.length >= batchSize) {
        const batch = buffer;
        buffer = [];
        chain = chain
          .then(() => postBatch(batch))
          .then(() => sleep(batchDelayMs))
          .catch(fail);
      }
    });

    parser.on('end', () => {
      chain = chain
        .then(() => postBatch(buffer))
        .then(resolve)
        .catch(fail);
    });

    readStream.pipe(parser);
  });

  console.log('---');
  console.log(`entries:    ${totalEntries}`);
  console.log(`snapshots:  ${totalSnapshots}`);
  console.log(`batches:    ${batchesSent}`);
  console.log(`inserted:   ${totalInserted}`);
  console.log(`updated:    ${totalUpdated}`);
  console.log(`skipped:    ${totalSkipped}`);
}

void main().catch((err) => {
  console.error('push_to_api failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});

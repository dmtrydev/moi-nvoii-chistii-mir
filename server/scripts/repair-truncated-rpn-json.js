/**
 * Восстанавливает обрезанный в конце JSON реестра РПН: убирает незавершённый
 * последний элемент в массиве и дописывает закрывающие ] и } по стеку.
 *
 *   node scripts/repair-truncated-rpn-json.js path/to/licenses.json
 *
 * Создаётся бэкап path/to/licenses.json.bak
 */
import fs from 'node:fs';
import path from 'node:path';

function closingSequenceForPrefix(s, end) {
  const stack = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < end; i++) {
    const c = s[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (inStr) {
      if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      if (stack.length) stack.pop();
    }
  }
  return stack.reverse().join('');
}

const reNextWtElem = /\},\r?\n\s*\{\r?\n\s*"piking"/g;

function findCutAfterLastCompleteWasteEntry(s) {
  let last = -1;
  let m;
  while ((m = reNextWtElem.exec(s)) !== null) {
    last = m.index;
  }
  if (last < 0) return -1;
  return last + 1;
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node scripts/repair-truncated-rpn-json.js <file.json>');
  process.exit(1);
}

const abs = path.isAbsolute(jsonPath) ? jsonPath : path.resolve(process.cwd(), jsonPath);
if (!fs.existsSync(abs)) {
  console.error('File not found:', abs);
  process.exit(1);
}

console.log('Reading:', abs);
const s = fs.readFileSync(abs, 'utf8');
let cut = findCutAfterLastCompleteWasteEntry(s);
if (cut < 0) {
  console.error('Could not find pattern },{+"piking" — файл в неожиданном формате.');
  process.exit(1);
}

const prefix = s.slice(0, cut);
const suffix = closingSequenceForPrefix(prefix, prefix.length);
const repaired = prefix + suffix;

try {
  JSON.parse(repaired);
} catch (e) {
  console.error('Repair failed validation:', e instanceof Error ? e.message : e);
  process.exit(1);
}

const bak = `${abs}.bak`;
fs.copyFileSync(abs, bak);
console.log('Backup:', bak);
fs.writeFileSync(abs, repaired, 'utf8');
console.log('OK: repaired, length', s.length, '->', repaired.length);

#!/usr/bin/env bash
# Оркестратор ночной синхронизации с реестром Росприроднадзора.
# Запускается из crontab на VDS:
#   0 3 * * *  /opt/moinoviichistiimir/parser/sync_rpn.sh >> /var/log/rpn-sync.log 2>&1
#
# Что делает:
#   1. Запрашивает у нашего API список ИНН для синка (приоритизированный).
#   2. Запускает Python-парсер, который ходит в реестр по этим ИНН.
#   3. Передаёт собранный JSON в Node-помощник, который шлёт батчи в API upsert.
#
# Требования на VDS:
#   - bash, curl, python3 (>=3.9), node (>=20).
#   - Установленный pip-пакет curl_cffi (см. instruction.txt).
#   - .env-файл рядом со скриптом (см. parser/.env.example).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
WORK_DIR="${SCRIPT_DIR}/work"
INNS_FILE="${WORK_DIR}/INNS.txt"
LICENSES_JSON="${WORK_DIR}/licenses.json"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} не найден. Скопируйте parser/.env.example в parser/.env и заполните." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${API_BASE_URL:?API_BASE_URL не задан в .env}"
: "${RPN_SYNC_TOKEN:?RPN_SYNC_TOKEN не задан в .env}"

INNS_LIMIT="${INNS_LIMIT:-10000}"
STALE_DAYS="${STALE_DAYS:-7}"

mkdir -p "${WORK_DIR}"
cd "${WORK_DIR}"

echo "[$(date -u +%FT%TZ)] sync_rpn: получаю список ИНН (limit=${INNS_LIMIT}, staleDays=${STALE_DAYS})"

curl --silent --show-error --fail \
  --header "Authorization: Bearer ${RPN_SYNC_TOKEN}" \
  --header "Accept: application/json" \
  --output "${WORK_DIR}/inns.json" \
  "${API_BASE_URL%/}/api/rpn-sync/inns-to-sync?limit=${INNS_LIMIT}&staleDays=${STALE_DAYS}"

# Извлекаем массив "inns" → построчный INNS.txt с фильтром только цифр.
node --input-type=module -e "
  import fs from 'node:fs';
  const raw = fs.readFileSync(process.argv[1], 'utf8');
  const data = JSON.parse(raw);
  const inns = (data?.inns ?? []).filter((v) => /^\d{10}\$|^\d{12}\$/.test(String(v)));
  fs.writeFileSync(process.argv[2], inns.join('\n') + '\n', 'utf8');
  console.log('counts:', JSON.stringify(data?.counts ?? {}));
" "${WORK_DIR}/inns.json" "${INNS_FILE}"

INN_COUNT=$(wc -l < "${INNS_FILE}" | tr -d ' ')
echo "[$(date -u +%FT%TZ)] sync_rpn: получено ${INN_COUNT} ИНН"

if [[ "${INN_COUNT}" -eq 0 ]]; then
  echo "[$(date -u +%FT%TZ)] sync_rpn: нет ИНН для синка, пропускаю парсер"
  exit 0
fi

# Запуск Python-парсера. main.py читает INNS.txt и пишет licenses.json в текущей директории.
echo "[$(date -u +%FT%TZ)] sync_rpn: запускаю python parser"
python3 "${SCRIPT_DIR}/../main.py"

if [[ ! -f "${LICENSES_JSON}" ]]; then
  # main.py пишет в свою рабочую директорию (где запущен).
  if [[ -f "${SCRIPT_DIR}/../licenses.json" ]]; then
    mv "${SCRIPT_DIR}/../licenses.json" "${LICENSES_JSON}"
  else
    echo "ERROR: licenses.json не создан парсером" >&2
    exit 2
  fi
fi

JSON_BYTES=$(wc -c < "${LICENSES_JSON}" | tr -d ' ')
echo "[$(date -u +%FT%TZ)] sync_rpn: парсер завершён, licenses.json = ${JSON_BYTES} байт"

# Передаём JSON в Node-помощник, который шлёт батчи в API.
echo "[$(date -u +%FT%TZ)] sync_rpn: отправляю батчи upsert"
node "${SCRIPT_DIR}/push_to_api.mjs" "${LICENSES_JSON}"

echo "[$(date -u +%FT%TZ)] sync_rpn: готово"

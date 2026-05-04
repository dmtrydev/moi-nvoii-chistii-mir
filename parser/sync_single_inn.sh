#!/usr/bin/env bash
# Ручное обновление снимка реестра РПН для одного ИНН (без запроса inns-to-sync).
# Пишет в таблицу rpn_registry_snapshot (поля date_issued, статус, pps_deadline_at и т.д.).
# Таблица licenses этим скриптом не изменяется.
#
# Использование:
#   chmod +x parser/sync_single_inn.sh
#   ./parser/sync_single_inn.sh 7707083893
#
# Требования: те же, что у sync_rpn.sh (.env с API_BASE_URL и RPN_SYNC_TOKEN).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
WORK_DIR="${SCRIPT_DIR}/work"
INNS_FILE="${WORK_DIR}/INNS.txt"
LICENSES_JSON="${WORK_DIR}/licenses.json"

INN_RAW="${1:-}"
INN="${INN_RAW//[^0-9]/}"

if [[ -z "${INN}" ]] || { [[ ${#INN} -ne 10 ]] && [[ ${#INN} -ne 12 ]]; }; then
  echo "Usage: $0 <ИНН_10_или_12_цифр>" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} не найден." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${API_BASE_URL:?API_BASE_URL не задан в .env}"
: "${RPN_SYNC_TOKEN:?RPN_SYNC_TOKEN не задан в .env}"

mkdir -p "${WORK_DIR}"
printf '%s\n' "${INN}" > "${INNS_FILE}"

echo "[$(date -u +%FT%TZ)] sync_single_inn: ИНН=${INN}, рабочая директория=${WORK_DIR}"

cd "${WORK_DIR}"
python3 "${SCRIPT_DIR}/../main.py"

if [[ ! -f "${LICENSES_JSON}" ]]; then
  if [[ -f "${SCRIPT_DIR}/../licenses.json" ]]; then
    mv "${SCRIPT_DIR}/../licenses.json" "${LICENSES_JSON}"
  else
    echo "ERROR: licenses.json не создан (в реестре может не быть записи по этому ИНН)." >&2
    exit 2
  fi
fi

node "${SCRIPT_DIR}/push_to_api.mjs" "${LICENSES_JSON}"
echo "[$(date -u +%FT%TZ)] sync_single_inn: готово"

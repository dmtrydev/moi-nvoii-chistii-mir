#!/usr/bin/env bash
# Скрипт сборки и загрузки сайта на сервер через rsync.
# Использование:
#   ./scripts/deploy-rsync.sh user@server:/var/www/greenx
# Или задайте переменную DEPLOY_TARGET:
#   export DEPLOY_TARGET=user@server:/var/www/greenx
#   ./scripts/deploy-rsync.sh

set -e
cd "$(dirname "$0")/.."

echo "Сборка проекта..."
npm run build

TARGET="${1:-$DEPLOY_TARGET}"
if [ -z "$TARGET" ]; then
  echo "Укажите цель деплоя: ./scripts/deploy-rsync.sh user@server:/var/www/greenx"
  exit 1
fi

echo "Загрузка dist/ на $TARGET ..."
rsync -avz --delete dist/ "$TARGET/"

echo "Готово. Проверьте сайт в браузере."

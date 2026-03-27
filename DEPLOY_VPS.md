# Деплой на VPS (Ubuntu 24.04) + обновления

Этот документ описывает, как поднять проект на VPS с Ubuntu 24.04 и как правильно применять обновления из Git. Пример ниже использует путь `/opt/moinoviichistiimir` и домен `app.moinovichistimir.ru`.

## 0) Что должно быть

1. VPS с Ubuntu 24.04
2. Доступ по SSH (например Bitvise SSH)
3. Домен `app.moinovichistimir.ru`, указывающий на IPv4 `109.73.197.109`
4. DNS уже настроен (A/AAAA запись), чтобы Let’s Encrypt смог выдать сертификат

## 1) Установка системных зависимостей

1. Обновить систему:
   ```bash
   sudo apt update
   ```

2. Поставить утилиты:
   ```bash
   sudo apt install -y git curl build-essential nginx certbot python3-certbot-nginx openssl python3-pip
   ```

3. Поставить pdfplumber (извлечение таблиц из PDF-лицензий):
   ```bash
   pip3 install pdfplumber --break-system-packages
   ```

## 2) Node.js 20

1. Поставить Node.js 20:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   sudo apt install -y nodejs
   ```

2. Проверить:
   ```bash
   node -v
   npm -v
   ```

## 3) PostgreSQL и БД проекта

1. Установить:
   ```bash
   sudo apt install -y postgresql postgresql-contrib
   ```

2. Включить автозапуск:
   ```bash
   sudo systemctl enable --now postgresql
   ```

3. Создать БД и пользователя (примерные имена `moinoviichistiimir`):
   - Сначала создайте пароль и сохраните его в стороне:
     ```bash
     DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
     echo "DB_PASSWORD=$DB_PASSWORD"
     ```
   - Затем создайте роль и базу:
     ```bash
     sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
     DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='moinoviichistiimir') THEN
         CREATE ROLE moinoviichistiimir LOGIN PASSWORD 'REPLACE_DB_PASSWORD';
       END IF;
     END$$;

     DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='moinoviichistiimir') THEN
         CREATE DATABASE moinoviichistiimir OWNER moinoviichistiimir;
       END IF;
     END$$;
     SQL
     ```

   Замените `REPLACE_DB_PASSWORD` на ваш реальный пароль.

4. Включить pgcrypto (нужно, потому что таблица `sessions` использует `gen_random_uuid()`):
   ```bash
   sudo -u postgres psql -d moinoviichistiimir -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
   ```

## 4) Клон репозитория

1. Создать папку:
   ```bash
   sudo mkdir -p /opt/moinoviichistiimir
   cd /opt/moinoviichistiimir
   ```

2. Склонировать репозиторий:
   ```bash
   git clone https://github.com/dmtrydev/moi-nvoii-chistii-mir .
   ```

## 5) Настроить `server/.env` на VPS

На VPS сервер читает файл `server/.env` (dotenv). Файл должен существовать.

## 5.1) Вариант: создать `server/.env` вручную

Файл должен содержать минимум:
- `PORT` (обычно `3001`)
- `NODE_ENV=production`
- `DATABASE_URL` (строка подключения к PostgreSQL)
- `JWT_ACCESS_SECRET` (любой длинный секрет)

Пример:
```bash
cd /opt/moinoviichistiimir
sudo mkdir -p server
sudo tee server/.env >/dev/null <<'EOF'
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://moinoviichistiimir:YOUR_DB_PASSWORD@localhost:5432/moinoviichistiimir
JWT_ACCESS_SECRET=YOUR_JWT_SECRET

# Опционально для лицензий/геокодирования:
# TIMEWEB_ACCESS_ID=...
# TIMEWEB_BEARER_TOKEN=...
# YANDEX_GEOCODER_API_KEY=...
# VIRUSTOTAL_API_KEY=...

# Опционально для кадастровой карты (векторные контуры):
# CADASTRE_PKK_API_BASE=https://nspd.gov.ru
# CADASTRE_PKK_REFERER=https://nspd.gov.ru/map?thematic=PKK
EOF
```

## 5.2) Важно про ownership таблиц

Сервер при старте делает `init.sql` и миграции через `query(...)`. Чтобы не было ошибки `must be owner of table ...`, таблицы и объекты должны принадлежать пользователю, указанному в `DATABASE_URL` (обычно `moinoviichistiimir`), а не `postgres`.

## 6) Инициализация БД (таблицы/миграции)

Обычно это можно сделать автоматически при старте сервера (в проекте есть ensureDatabaseSchema), но если нужно принудительно:

1. Применить `init.sql`:
   ```bash
   sudo -u postgres psql -d moinoviichistiimir -f /opt/moinoviichistiimir/server/db/init.sql
   ```

2. Применить миграцию:
   ```bash
   sudo -u postgres psql -d moinoviichistiimir -f /opt/moinoviichistiimir/server/db/migrations/eco-auth-dashboard.sql
   ```

## 7) Сборка фронта на VPS

```bash
cd /opt/moinoviichistiimir
npm run build:client
```

Проверка:
- существует `/opt/moinoviichistiimir/dist/index.html`

## 8) Установка зависимостей

```bash
cd /opt/moinoviichistiimir && npm install && cd server && npm install
```

## 9) Запуск сервера через PM2 (рекомендуется)

1. Установить PM2 глобально:
   ```bash
   sudo npm install -g pm2
   ```

2. Первый запуск приложения под PM2:
   ```bash
   cd /opt/moinoviichistiimir
   pm2 start npm --name moinoviichistiimir -- start
   ```

3. Проверить статус и логи:
   ```bash
   pm2 status
   pm2 logs moinoviichistiimir --lines 100
   ```

4. Включить автозапуск PM2 после ребута:
   ```bash
   pm2 startup systemd -u $USER --hp $HOME
   pm2 save
   ```

Приложение отдаёт статику фронта из `dist/` и API с `/api/*`.

Проверка локально:
```bash
curl -I http://127.0.0.1:3001/map
```

## 10) nginx reverse proxy под домен

1. Создать конфиг:
   ```bash
   sudo tee /etc/nginx/sites-available/app.moinovichistimir.ru.conf >/dev/null <<'EOF'
   server {
     listen 80;
     listen [::]:80;

     server_name app.moinovichistimir.ru;
     client_max_body_size 50m;

     location / {
       proxy_pass http://127.0.0.1:3001;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
EOF
   ```

2. Включить сайт и проверить конфиг:
   ```bash
   sudo ln -sf /etc/nginx/sites-available/app.moinovichistimir.ru.conf /etc/nginx/sites-enabled/app.moinovichistimir.ru.conf
   sudo /usr/sbin/nginx -t
   sudo systemctl reload nginx
   ```

## 11) SSL сертификат Let’s Encrypt

1. Выдать сертификат и включить редирект:
   ```bash
   sudo certbot --nginx -d app.moinovichistimir.ru --redirect
   ```

2. Проверить:
   - `https://app.moinovichistimir.ru/`

## 12) Как правильно применять обновления на VPS

Когда ты вносишь изменения в код и делаешь commit/push в Git, обновление на VPS делается так:

## 12.1) Обновить код и зависимости

```bash
cd /opt/moinoviichistiimir
git pull
npm install
cd server && npm install && cd ..
```

## 12.2) Пересобрать фронт

```bash
npm run build:client
```

## 12.3) Перезапустить сервер (PM2)

1. Если приложение уже было добавлено в PM2:
   ```bash
   cd /opt/moinoviichistiimir
   pm2 restart moinoviichistiimir
   ```

2. Если это первый запуск через PM2:
   ```bash
   cd /opt/moinoviichistiimir
   pm2 start npm --name moinoviichistiimir -- start
   pm2 save
   ```

## 12.4) Проверка после обновления

1. Проверить статику:
   ```bash
   curl -I https://app.moinovichistimir.ru/map
   ```

2. Проверить API:
   ```bash
   curl -I https://app.moinovichistimir.ru/api/auth/me
   ```

Без токена будет `401`, но это нормально.

## 13) Частые проблемы

1. `DB schema initialized/ensured` падает с `must be owner of table ...`
   - нужно, чтобы `init.sql`/миграции создавали таблицы владельцем пользователя из `DATABASE_URL`

2. `502 Bad Gateway` на кадастровой карте
   - обычно upstream к НСПД/ПКК медленный или отваливается; в этом случае смотрят `X-Cadastre-Warning` в ответе `/api/cadastre/parcels`

3. `401 Unauthorized` на `/api/auth/refresh`
   - нормально, если пользователь не залогинен; refresh работает через cookie после логина

## 14) Обновления после правок кода (как действовать)

Когда ты что-то меняешь в коде локально (исправления багов, правки auth, фронт и т.д.), правильный процесс для VPS такой:

1. **Сначала всё проверить локально**
   - запускай проект у себя (как обычно), чтобы убедиться, что изменение действительно работает;
   - при необходимости проверь страницы логина/регистрации и карту.
   - пример запуска (локально): в корне проекта:
     ```bash
     npm start
     ```

2. **Закоммить изменения в Git локально**
   - делай коммит с понятным сообщением, чтобы потом было легко понять, что обновлялось.
   - пример:
     ```bash
     git add .
     git commit -m "Fix: registration/auth updates"
     ```

3. **Запушь изменения в удалённый репозиторий (GitHub)**
   - твой VPS подтянет обновления командой “получить последние изменения” при следующем шаге.
   - пример:
     ```bash
     git push origin master
     ```
   - если у тебя другая ветка, подставь её вместо `master`.

4. **На VPS выполнить обновление кода из Git**
   - зайди в папку проекта на VPS (`/opt/moinoviichistiimir`);
   - подтяни последние изменения из удалённого репозитория.
   - пример:
     ```bash
     cd /opt/moinoviichistiimir
     git pull
     ```

5. **Переустановить зависимости (если это нужно)**
   - если ты менял зависимости (например `package.json`), на VPS обнови `node_modules`;
   - если зависимости не менялись, обычно это можно пропустить, но безопаснее выполнить повторно.
   - пример (безопасно, но может занять время):
     ```bash
     cd /opt/moinoviichistiimir && npm install && cd server && npm install
     ```

6. **Пересобрать фронтенд (`dist`)**
   - это обязательно: сервер раздаёт статику именно из `dist/`;
   - после сборки проверь, что `dist/index.html` действительно обновился (дата/время на файле).
   - пример:
     ```bash
     cd /opt/moinoviichistiimir
     npm run build:client
     ```

7. **Перезапустить Node-сервер через PM2**
   - если приложение уже зарегистрировано в PM2, выполняй только `pm2 restart moinoviichistiimir`;
   - чтобы не получить ситуацию “старый backend остался на `3001`, а новый стартовал на `3002`” (из-за занятого порта), сделай проверку портов перед перезапуском:
     ```bash
     ss -ltnp | grep ':3001' || true
     ss -ltnp | grep ':3002' || true
     ```
   - если видишь `node` в строках выше, убей именно тот PID (показывается в выводе `ss`), например:
     ```bash
     kill -9 <PID>
     ```
   - параметры `server/.env` **НЕ трогай** (они игнорируются Git и задают доступ к БД и JWT).
   - перезапуск через PM2:
     ```bash
     cd /opt/moinoviichistiimir
     pm2 restart moinoviichistiimir || pm2 start npm --name moinoviichistiimir -- start
     pm2 save
     ```

8. **nginx, как правило, перезапускать не нужно**
   - nginx только проксирует запросы на Node (и раздаёт статику только если настроено иначе);
   - после успешного перезапуска Node всё должно заработать автоматически.

9. **Фиксация “какой порт поднялся” и быстрый sanity-check**
   - подожди 2-5 секунд после старта и проверь, на каком порту реально поднялся API (это критично для корректной работы фронтенда, т.к. `VITE_API_URL` вшивается в `dist` при сборке):
     ```bash
     sleep 2
     curl -sS http://127.0.0.1:3001/api/health || true
     curl -sS http://127.0.0.1:3002/api/health || true
     ```
   - после этого открой логи:
     ```bash
     pm2 logs moinoviichistiimir --lines 80
     ```
   - если backend поднялся НЕ на `3001` (например, на `3002` из-за занятого `3001`), то либо:
     - убеди проект работать на `3001` (освободи порт `3001` и перезапусти backend), либо
     - обнови переменную `VITE_API_URL` в корневом `.env` на `3002` и заново пересобери фронтенд (`npm run build:client`).

10. **Проверка после обновления**
   - открыть `https://app.moinovichistimir.ru/map`;
   - открыть `/login` и попробовать регистрацию + вход;
   - если что-то сломалось — смотреть логи процесса Node на VPS через PM2.
   - быстрые проверки командами:
     ```bash
     curl -I https://app.moinovichistimir.ru/map
     curl -I https://app.moinovichistimir.ru/api/auth/me
     ```
   - и логи:
     ```bash
     pm2 logs moinoviichistiimir --lines 200
     ```

Быстрый сценарий обновления:
```bash
cd /opt/moinoviichistiimir
git pull
npm run build:client
pm2 restart moinoviichistiimir || pm2 start npm --name moinoviichistiimir -- start
pm2 save
sleep 2
curl -sS http://127.0.0.1:3001/api/health
curl -sS http://127.0.0.1:3002/api/health || true
pm2 logs moinoviichistiimir --lines 40
```


sudo -u postgres psql -d moinoviichistiimir -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

-- Удаляем в правильном порядке (от зависимых к родительским)
TRUNCATE site_fkko_activities CASCADE;
TRUNCATE license_sites CASCADE;
TRUNCATE transactions CASCADE;
TRUNCATE licenses CASCADE;

-- Сбрасываем счётчики id, чтобы новые записи шли с 1
ALTER SEQUENCE licenses_id_seq RESTART WITH 1;
ALTER SEQUENCE license_sites_id_seq RESTART WITH 1;
ALTER SEQUENCE site_fkko_activities_id_seq RESTART WITH 1;
ALTER SEQUENCE transactions_id_seq RESTART WITH 1;

COMMIT;
SQL

Перевел ваш деплой на pm2 и обновил DEPLOY_VPS.md (разделы запуска/перезапуска и быстрый сценарий).

Что теперь делать на VPS один раз:

cd /opt/moinoviichistiimir
sudo npm install -g pm2
pm2 start npm --name moinoviichistiimir -- start
pm2 startup systemd -u $USER --hp $HOME
pm2 save
pm2 status
Дальше при каждом обновлении:

cd /opt/moinoviichistiimir
git pull
npm run build:client
pm2 restart moinoviichistiimir
pm2 save
Если снова увидите 502, сразу смотрите:

pm2 logs moinoviichistiimir --lines 200
curl -sS http://127.0.0.1:3001/api/health || true
sudo tail -n 100 /var/log/nginx/error.log
# Синхронизация с реестром Росприроднадзора (РПН)

Документ описывает, как ночная задача обновляет в нашей БД данные о
лицензиях по обращению с отходами I–IV классов опасности и срок ближайшего
периодического подтверждения соответствия (ППС).

## Зачем это нужно

С 1 сентября 2024 года введена процедура периодического подтверждения
соответствия лицензионным требованиям (ФЗ № 170-ФЗ от 28.04.2023, ПП РФ
№ 622 от 16.05.2024). Лицензия на обращение с отходами действует бессрочно,
но лицензиат обязан раз в три года проходить ППС. Если ППС не пройдено —
лицензия в реестре переходит в статус `paused`/`terminated`/`annulled`.

Эта подсистема:
- держит в БД актуальный «статус лицензии в реестре РПН» по каждому ИНН;
- считает «нижнюю оценку» дедлайна ближайшего ППС по дате выдачи;
- отображает в карточке предприятия цветной бейдж (зелёный/жёлтый/красный/серый)
  с понятным сообщением и дисклеймером.

## Юридическая логика расчёта дедлайна

Источники в реестре РПН (`tor.knd.gov.ru`) — только базовые поля:
- `dateIssued` — дата выдачи лицензии;
- `status` — текущий статус (`active`, `paused`, `pausedpart`, `terminated`,
  `annulled`).

Поля «дата последнего планового КНМ» и «дата уже пройденного ППС» в выгрузке
**отсутствуют**. Поэтому расчёт ведётся по правилу:

```
deadline = max(dateIssued, 2024-09-01) + 3 года
если deadline < 2025-03-01 → deadline = 2025-03-01
```

Для лицензий, выданных до 01.09.2024, это даёт единый дедлайн `2027-09-01`.
Для лицензий, выданных позже, — индивидуальный (`dateIssued + 3 года`).

В UI предусмотрен дисклеймер: фактический срок может быть позже расчётного,
если контрагент уже прошёл ППС после 01.03.2025.

## Архитектура

```
┌────────────┐     1. GET /api/rpn-sync/inns-to-sync      ┌────────────────┐
│   crontab  │ ────────────────────────────────────────▶ │  Node-сервер   │
│  на VDS    │ ◀──────  список ИНН (приоритизирован) ─── │  /api/rpn-sync │
│            │                                            │                │
│            │  2. python3 main.py  (читает INNS.txt,                       │
│            │      ходит в tor.knd.gov.ru, пишет licenses.json)            │
│            │                                                              │
│            │  3. node push_to_api.mjs licenses.json                       │
│            │     батчи по 500 → POST /api/rpn-sync/upsert  ───────────▶  │
│            │     (Bearer RPN_SYNC_TOKEN)                                  │
│            │                                                              │
└────────────┘                                            │  ↓             │
                                                          │  Postgres      │
                                                          │  rpn_registry_ │
                                                          │  snapshot      │
                                                          └────────────────┘
```

В БД `licenses` cron не пишет вообще — ручные правки админа никогда не затираются.
Снапшот реестра живёт в отдельной таблице `rpn_registry_snapshot` и
присоединяется к карточке через `LEFT JOIN inn_norm`.

## Развёртывание на VDS

### 1. Установить зависимости

```bash
sudo apt update && sudo apt install -y python3 python3-pip nodejs curl
pip install curl_cffi
node --version  # должно быть >= 20
```

### 2. Развернуть код

```bash
sudo mkdir -p /opt/moinoviichistiimir
sudo chown $USER:$USER /opt/moinoviichistiimir
git clone <ваш-репо> /opt/moinoviichistiimir
cd /opt/moinoviichistiimir
npm install --omit=dev
cd server && npm install --omit=dev && cd ..
cd parser && npm install --omit=dev && cd ..
```

### 3. Настроить токен

На сервере (там, где крутится наш Node API):

```bash
# server/.env (на сервере)
echo "RPN_SYNC_TOKEN=$(openssl rand -hex 32)" >> server/.env
```

Тот же токен скопируйте в `parser/.env` на VDS:

```bash
cd /opt/moinoviichistiimir/parser
cp .env.example .env
nano .env  # заполнить API_BASE_URL и RPN_SYNC_TOKEN
chmod 600 .env  # токен — секрет
chmod +x sync_rpn.sh
```

### 4. Тестовый запуск

```bash
# Сначала с маленьким лимитом, чтобы убедиться, что всё работает.
INNS_LIMIT=10 /opt/moinoviichistiimir/parser/sync_rpn.sh
```

Должно вывестись:
```
sync_rpn: получаю список ИНН (limit=10, staleDays=7)
counts: {"high":10,"medium":0,"low":0,"total":10}
sync_rpn: получено 10 ИНН
sync_rpn: запускаю python parser
... [Python-парсер пишет в свой run.log] ...
sync_rpn: парсер завершён, licenses.json = ... байт
sync_rpn: отправляю батчи upsert
batch #1: sent=N inserted=A updated=B skipped=C
sync_rpn: готово
```

Проверка через API:
```bash
curl -H "Authorization: Bearer $RPN_SYNC_TOKEN" \
     https://your-domain.example/api/rpn-sync/stats
```

### 5. Поставить в crontab

```bash
crontab -e
```

Добавить строку (запуск каждую ночь в 03:00 по серверному времени):

```cron
0 3 * * * /opt/moinoviichistiimir/parser/sync_rpn.sh >> /var/log/rpn-sync.log 2>&1
```

Логи — `/var/log/rpn-sync.log` и `parser/work/run.log` (последний пишет сам
Python-парсер).

### 6. Мониторинг

- `GET /api/rpn-sync/stats` (с Bearer-токеном) — общая статистика snapshot.
- В `audit_logs` каждое успешное выполнение пишется как `RPN_SYNC_UPSERT` с
  агрегатами (`{ inserted, updated, total, durationMs }`). Раскрытия
  персональных данных контрагентов в логах нет.
- Если cron упал, в `/var/log/rpn-sync.log` видно `set -e`-фейл; следующий
  запуск пройдёт автоматически — функция идемпотентна.

## Безопасность

- `RPN_SYNC_TOKEN` — отдельный сервисный токен, не пользовательский JWT.
  Если токен утёк — ротация одной строкой `openssl rand -hex 32` и обновление
  в `server/.env` + `parser/.env`. JWT-сессии пользователей не затрагиваются.
- Эндпойнты `/api/rpn-sync/*` имеют свой rate-limit 60 запросов/мин по IP.
- Если `RPN_SYNC_TOKEN` не задан в `server/.env`, эндпойнты возвращают 503.
  Это безопасный дефолт — нельзя случайно открыть запись в БД на проде.
- Тело запроса лимитировано 500 строками; невалидные строки пропускаются и
  возвращаются клиенту в `skipped[]` (не валят весь батч).

## Поведение при ошибках

| Что произошло | Что будет |
|---|---|
| Сайт `tor.knd.gov.ru` лежит | Парсер запишет `брак` в `run.log`, ИНН будет повторно обработан в следующую ночь |
| API сервер недоступен | `sync_rpn.sh` упадёт на curl, cron повторит попытку завтра |
| Ошибка парсинга записи | `extractSnapshot` вернёт `null`, запись пропускается, остальные продолжают |
| Время выполнения > 2 часов | Если поставите в crontab `timeout 7200` — kill, остальные ИНН подтянутся в следующий запуск |

## Одна конкретная организация (один ИНН)

В реестре отходов лицензия **не имеет «даты окончания»** в привычном смысле: она
ведётся бессрочно, а контрольный срок в интерфейсе — это **периодическое
подтверждение соответствия (ППС)**. Он считается на бэкенде из полей снимка
(`date_issued`, статус реестра) и сохраняется в колонке **`pps_deadline_at`**
таблицы **`rpn_registry_snapshot`**. Строка в снимке **одна на нормализованный
ИНН** (`inn_norm`), не на внутренний `id` из `licenses`.

Чтобы подтянуть с `tor.knd.gov.ru` актуальные данные **по одному ИНН** и записать
их в БД:

```bash
cd /opt/moinoviichistiimir/parser
chmod +x sync_single_inn.sh
./sync_single_inn.sh 7707083893
```

Скрипт кладёт ИНН в `parser/work/INNS.txt`, запускает корневой `main.py`, затем
`push_to_api.mjs` → `POST /api/rpn-sync/upsert`. Если по ИНН в реестре пусто,
`licenses.json` может не появиться — смотрите `parser/work/run.log`.

Вручную без обёртки: в каталоге с `INNS.txt` (одна строка — ИНН) выполнить
`python3 main.py`, затем `node parser/push_to_api.mjs licenses.json` с тем же
`.env`, что у cron.

Проверка в Postgres:

```sql
SELECT inn_norm, license_number, date_issued, registry_status_ru,
       pps_deadline_at, synced_at
FROM rpn_registry_snapshot
WHERE inn_norm = '7707083893';
```

Таблица **`licenses`** этим пайплайном **не обновляется** — только снимок для
JOIN по ИНН.

## Откат

Если нужно полностью отключить функциональность:
1. Убрать строку из `crontab`.
2. Удалить `RPN_SYNC_TOKEN` из `server/.env`. Эндпойнты вернут 503.
3. (Опционально) `TRUNCATE rpn_registry_snapshot;` — карточки начнут показывать
   серый бейдж «данные о лицензии не получены».

Сама таблица не мешает работе сайта: блок «Лицензия в реестре РПН»
дегрейдится корректно при отсутствии данных.

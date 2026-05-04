import json
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from curl_cffi import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("run.log", encoding="utf-8"),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger(__name__)

THREADS = 10

lock = threading.Lock()
success_count = 0
empty_count = 0
total = 0
is_first_entry = True


def get_json(inn: str):
    headers = {
        'Host': 'tor.knd.gov.ru',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    }
    json_data = {
        'search': {
            'search': [
                {
                    'field': 'units.id',
                    'operator': 'nin',
                    'value': [
                        '5fbcbdee1bfbcb0001c2a0d8',
                        '5e1f13bd981b02000139851d',
                    ],
                },
                {
                    'field': 'registryEntryType.code',
                    'operator': 'eq',
                    'value': 'wasteLicensing',
                },
                {
                    'orSubConditions': [
                        {
                            'field': 'subject.data.organization.inn',
                            'operator': 'like',
                            'value': inn,
                        },
                        {
                            'field': 'subject.data.person.inn',
                            'operator': 'like',
                            'value': inn,
                        },
                    ],
                },
                {
                    'field': 'status',
                    'operator': 'neq',
                    'value': 'draft',
                },
            ],
        },
        'page': 0,
        'size': 10,
        'prj': 'licensesWasteRPN',
    }
    response = requests.post(
        'https://tor.knd.gov.ru/ext/search/licensesWasteRPN',
        headers=headers,
        json=json_data,
        verify=False
    )
    response.encoding = "utf-8"
    return response.json()


def process_inn(inn: str, out_file):
    global success_count, empty_count, is_first_entry
    try:
        obj = get_json(inn)
        if obj['content'] != []:
            with lock:
                success_count += 1
                done = success_count + empty_count
                if not is_first_entry:
                    out_file.write(",\n")
                json.dump(obj, out_file, indent=4, ensure_ascii=False)
                out_file.flush()
                is_first_entry = False
                log.info(f"[{done}/{total}] ИНН {inn} — найдено | успешных: {success_count} | брак: {empty_count}")
        else:
            with lock:
                empty_count += 1
                done = success_count + empty_count
                log.info(f"[{done}/{total}] ИНН {inn} — брак    | успешных: {success_count} | брак: {empty_count}")
    except Exception as e:
        with lock:
            empty_count += 1
            done = success_count + empty_count
            log.error(f"[{done}/{total}] ИНН {inn} — ошибка: {e} | успешных: {success_count} | брак: {empty_count}")


def main():
    global total
    with open("INNS.txt", "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f.readlines()]

    inns = [l for l in lines if l.isdigit() and "0000000000" not in l]
    total = len(inns)
    log.info(f"Загружено {total} ИНН для обработки (потоков: {THREADS})")

    with open("licenses.json", "w", encoding="utf-8") as out_file:
        out_file.write("[\n")
        with ThreadPoolExecutor(max_workers=THREADS) as executor:
            futures = [executor.submit(process_inn, inn, out_file) for inn in inns]
            for future in as_completed(futures):
                future.result()
        out_file.write("\n]")

    log.info(f"Итого: успешных {success_count} | брак {empty_count} | всего {total}")


if __name__ == "__main__":
    main()
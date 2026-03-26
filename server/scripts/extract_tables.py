#!/usr/bin/env python3
"""
Извлекает таблицы ФККО из PDF-лицензий с помощью pdfplumber.
Использование: python3 extract_tables.py <path_to_pdf>
Выводит JSON в stdout.
"""
import sys
import json
import re
import pdfplumber

FKKO_RE = re.compile(r'\d[\s.]*\d{2}[\s.]*\d{3}[\s.]*\d{2}[\s.]*\d{2}[\s.]*\d')
FKKO_COMPACT_RE = re.compile(r'\d{11}')
HAZARD_RE = re.compile(r'\b(I{1,3}V?|IV|V)\b')
ACTIVITY_WORDS = [
    'Сбор', 'Транспортирование', 'Обезвреживание',
    'Утилизация', 'Размещение', 'Обработка', 'Захоронение',
]


def normalize_fkko(code: str) -> str:
    return re.sub(r'\D', '', code)


def find_fkko_in_text(text: str) -> str | None:
    m = FKKO_RE.search(text)
    if m:
        return normalize_fkko(m.group())
    m = FKKO_COMPACT_RE.search(text)
    if m and len(m.group()) == 11:
        return m.group()
    return None


def extract_activity(text: str) -> str | None:
    for act in ACTIVITY_WORDS:
        if act.lower() in text.lower():
            return act
        if act[:8].lower() in text.lower():
            return act
    return None


def extract_hazard(text: str) -> str:
    m = HAZARD_RE.search(text)
    return m.group(1) if m else ''


def process_table_row(cells: list[str | None]) -> dict | None:
    """Пытается распознать строку таблицы ФККО.
    Таблицы лицензий обычно имеют 5-6 колонок:
    [№ п/п | Наименование отхода | Код ФККО | Класс опасности | Вид работ | Адрес]
    Порядок и количество могут отличаться.
    """
    clean = [str(c or '').strip() for c in cells]
    full_text = ' '.join(clean)

    fkko = find_fkko_in_text(full_text)
    if not fkko:
        return None

    activity = extract_activity(full_text)
    if not activity:
        return None

    hazard = extract_hazard(full_text)

    waste_name = ''
    address = ''

    fkko_col_idx = -1
    for i, cell in enumerate(clean):
        if find_fkko_in_text(cell) == fkko:
            fkko_col_idx = i
            break

    for i, cell in enumerate(clean):
        if not cell:
            continue
        if i == fkko_col_idx:
            continue
        if find_fkko_in_text(cell) and i != fkko_col_idx:
            continue
        if extract_activity(cell):
            continue
        if HAZARD_RE.fullmatch(cell.strip()):
            continue
        if re.fullmatch(r'\d{1,4}', cell.strip()):
            continue

        if re.search(r'Адрес\s+\d|^\d{6}|обл[.,\s]|область|р-н|район|ул[.\s]|поселок|город', cell, re.I):
            address = cell
        elif not waste_name:
            waste_name = cell

    return {
        'wasteName': waste_name,
        'fkkoCode': fkko,
        'hazardClass': hazard,
        'activityType': activity,
        'address': address,
    }


def extract(pdf_path: str) -> dict:
    rows = []
    header_text = ''

    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            if i < 2:
                text = page.extract_text() or ''
                header_text += text + '\n'

            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or all(c is None or str(c).strip() == '' for c in row):
                        continue
                    parsed = process_table_row(row)
                    if parsed:
                        rows.append(parsed)

    return {
        'headerText': header_text.strip(),
        'rows': rows,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: extract_tables.py <pdf_path>'}), file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    try:
        result = extract(pdf_path)
        json.dump(result, sys.stdout, ensure_ascii=False)
    except Exception as e:
        print(json.dumps({'error': str(e)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

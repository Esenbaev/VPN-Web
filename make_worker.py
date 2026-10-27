#!/usr/bin/env python3
"""Встраивает диапазоны IP Кыргызстана из базы DB-IP Country Lite в site/_worker.js.

Как пользоваться:
  1. Скачайте бесплатную базу (формат CSV, файл dbip-country-lite-ГГГГ-ММ.csv.gz):
     https://db-ip.com/db/download/ip-to-country-lite
  2. Запустите:  python make_worker.py путь/к/dbip-country-lite-ГГГГ-ММ.csv.gz
  3. Загрузите папку site на Cloudflare Pages.
Повторяйте раз в месяц, когда выходит новая версия базы.
"""
import csv, gzip, ipaddress, json, os, re, sys

COUNTRY = 'KG'  # Кыргызская Республика, код ISO 3166-1
HERE = os.path.dirname(os.path.abspath(__file__))
WORKER = os.path.join(HERE, 'site', '_worker.js')


def merge(ranges):
    ranges.sort()
    out = []
    for start, end in ranges:
        if out and start <= out[-1][1] + 1:
            out[-1][1] = max(out[-1][1], end)
        else:
            out.append([start, end])
    return out


def put(text, tag, value):
    pattern = re.compile(r'^(const %s = ).*?(; // @%s)$' % (tag, tag), re.M)
    if not pattern.search(text):
        sys.exit('В _worker.js не найдена строка с пометкой @' + tag)
    return pattern.sub(lambda m: m.group(1) + value + m.group(2), text)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    path = sys.argv[1]
    opener = gzip.open if path.lower().endswith('.gz') else open
    v4, v6, rows = [], [], 0
    with opener(path, 'rt', encoding='utf-8', newline='') as f:
        for row in csv.reader(f):
            if len(row) < 3:
                continue
            rows += 1
            if row[2].strip().upper() != COUNTRY:
                continue
            a = ipaddress.ip_address(row[0].strip())
            b = ipaddress.ip_address(row[1].strip())
            (v4 if a.version == 4 else v6).append([int(a), int(b)])
    if not rows:
        sys.exit('Файл пустой или это не CSV из DB-IP Country Lite.')
    v4, v6 = merge(v4), merge(v6)
    if not (v4 or v6):
        sys.exit('В файле нет диапазонов страны %s. Проверьте, что это DB-IP IP to Country Lite.' % COUNTRY)
    v6 = [[format(a, 'x'), format(b, 'x')] for a, b in v6]

    with open(WORKER, encoding='utf-8') as f:
        text = f.read()
    text = put(text, 'DB_INFO', json.dumps(os.path.basename(path), ensure_ascii=False))
    text = put(text, 'KG_V4', json.dumps(v4, separators=(',', ':')))
    text = put(text, 'KG_V6', json.dumps(v6, separators=(',', ':')))
    with open(WORKER, 'w', encoding='utf-8') as f:
        f.write(text)
    print('Готово: диапазонов IPv4 — %d, IPv6 — %d (строк в базе: %d).' % (len(v4), len(v6), rows))
    print('Теперь загрузите папку site на Cloudflare Pages.')


main()

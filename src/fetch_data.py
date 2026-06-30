#!/usr/bin/env python3
"""
Fetch FRED data and write to data/yield_curve.json and data/inflation.json.
Run once before serving the dashboard, or whenever you want fresh data.

  python3 src/fetch_data.py
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / 'data'
BASE_URL = 'https://api.stlouisfed.org/fred/series/observations'
START = '2000-01-01'

YIELD_CURVE_IDS = [
    'DGS1MO', 'DGS3MO', 'DGS6MO', 'DGS1', 'DGS2', 'DGS3',
    'DGS5', 'DGS7', 'DGS10', 'DGS20', 'DGS30',
    'DFII5', 'DFII7', 'DFII10', 'DFII20', 'DFII30',
    'T5YIE', 'T10YIE',
]

INFLATION_IDS = [
    'CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE',
    'PPIFIS', 'CES0500000003',  # PPIFIS = BLS PPI Final Demand SA (replaces PPIACO = All Commodities)
]


def load_fred_key():
    key = os.environ.get('FRED_API_KEY')
    if key:
        return key
    env_file = ROOT / '.env'
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            m = re.match(r"['\"]?FRED_API_KEY['\"]?\s*=\s*(.+)", line.strip())
            if m:
                return m.group(1).strip().strip("'\"")
    sys.exit('FRED_API_KEY not found in environment or .env file')


def fetch_series(series_id, api_key, units='lin'):
    r = requests.get(BASE_URL, params={
        'series_id': series_id,
        'observation_start': START,
        'units': units,
        'api_key': api_key,
        'file_type': 'json',
    }, timeout=30)
    r.raise_for_status()
    data = r.json()
    if 'error_message' in data:
        raise ValueError(f'FRED {series_id}: {data["error_message"]}')
    return [
        {'date': o['date'], 'value': float(o['value'])}
        for o in data['observations']
        if o['value'] != '.'
    ]


def main():
    api_key = load_fred_key()
    DATA_DIR.mkdir(exist_ok=True)
    fetched_at = datetime.now(timezone.utc).isoformat()

    print('Fetching yield curve series...')
    yc_series = {}
    for sid in YIELD_CURVE_IDS:
        print(f'  {sid}')
        yc_series[sid] = fetch_series(sid, api_key)
    out = DATA_DIR / 'yield_curve.json'
    out.write_text(json.dumps({'fetched_at': fetched_at, 'series': yc_series}, separators=(',', ':')))
    total = sum(len(v) for v in yc_series.values())
    print(f'  → {out.name} ({total:,} observations)\n')

    print('Fetching inflation series (YoY % change)...')
    infl_series = {}
    for sid in INFLATION_IDS:
        print(f'  {sid}')
        infl_series[sid] = fetch_series(sid, api_key, units='pc1')
    out = DATA_DIR / 'inflation.json'
    out.write_text(json.dumps({'fetched_at': fetched_at, 'series': infl_series}, separators=(',', ':')))
    total = sum(len(v) for v in infl_series.values())
    print(f'  → {out.name} ({total:,} observations)\n')

    print('Fetching inflation level series (for MoM computation)...')
    infl_level = {}
    for sid in INFLATION_IDS:
        print(f'  {sid}')
        infl_level[sid] = fetch_series(sid, api_key, units='lin')
    out = DATA_DIR / 'inflation_level.json'
    out.write_text(json.dumps({'fetched_at': fetched_at, 'series': infl_level}, separators=(',', ':')))
    total = sum(len(v) for v in infl_level.values())
    print(f'  → {out.name} ({total:,} observations)\n')

    print('Done.')


if __name__ == '__main__':
    main()

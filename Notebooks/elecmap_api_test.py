import requests
import json
from itertools import product
from datetime import datetime, timezone
from pathlib import Path
from tqdm import tqdm

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
RAW_DATA_DIR = PROJECT_ROOT / "Data" / "raw"
PRODUCTION_DIR = RAW_DATA_DIR / "per_countries" / "production"
API_TOKEN = "qmUpDAg9fsUxWyC2pDvp"
SOURCES = [
    "nuclear",
    "geothermal",
    "biomass",
    "coal",
    "wind",
    "solar",
    "hydro",
    "gas",
    "oil",
    "hydro-discharge",
    "battery-discharge",
]


def to_iso_utc(year, month, day):
    return datetime(year, month, day, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def quarter_ranges(year):
    # The Electricity Maps API treats `end` as excluded. Splitting the year
    # into quarters avoids the leap-year 2024 bug while still yielding
    # monthly points after aggregation.
    return [
        (to_iso_utc(year, 1, 1), to_iso_utc(year, 4, 1)),
        (to_iso_utc(year, 4, 1), to_iso_utc(year, 7, 1)),
        (to_iso_utc(year, 7, 1), to_iso_utc(year, 10, 1)),
        (to_iso_utc(year, 10, 1), to_iso_utc(year + 1, 1, 1)),
    ]


def get_country_codes_json():
    url = "https://api.electricitymaps.com/v3/zones"

    r = requests.get(url)
    zones = r.json()
    return zones


def extract_country_codes(zones):
    codes = []
    for country, info in zones.items():
        codes.append(info["zoneKey"])

    return codes


def make_request(zone, start_iso, end_iso, source):
    response = requests.get(
        f"https://api.electricitymaps.com/v3/electricity-source/{source}/past-range",
        params={
            "zone": zone,
            "start": start_iso,
            "end": end_iso,
            "temporalGranularity": "monthly",
        },
        headers={
            "auth-token": API_TOKEN
        },
        timeout=60,
    )
    return response


def fetch_yearly_source(zone, source, year):
    data = []
    metadata = {}

    for start_iso, end_iso in quarter_ranges(year):
        result = make_request(zone, start_iso, end_iso, source).json()

        if "error" in result:
            return result

        metadata = {
            key: value
            for key, value in result.items()
            if key != "data"
        }
        data.extend(result.get("data", []))

    deduped_data = sorted(
        {row["datetime"]: row for row in data}.values(),
        key=lambda row: row["datetime"],
    )

    return {
        **metadata,
        "data": deduped_data,
    }


def iterate_across_time_country_source(zones, sources, begin_year, end_year):
    years = list(range(begin_year, end_year + 1))

    for zone, source, year in tqdm(product(zones, sources, years)):
        output_dir = PRODUCTION_DIR / str(zone) / str(year)
        output_dir.mkdir(parents=True, exist_ok=True)

        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"
        file_name = f"{zone}_{source}_{start_date}_{end_date}.json"

        result = fetch_yearly_source(zone, source, year)

        with open(output_dir / file_name, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=4)


if __name__ == "__main__":
    zones = get_country_codes_json()
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(RAW_DATA_DIR / "country_codes.json", "w", encoding="utf-8") as f:
        json.dump(zones, f, ensure_ascii=False, indent=4)
    zones_codes = extract_country_codes(zones)

    begin_year = 2023
    end_year = 2026
    iterate_across_time_country_source(zones_codes, SOURCES, begin_year, end_year)

    

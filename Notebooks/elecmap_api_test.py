import requests
import json
from itertools import product
import os
from tqdm import tqdm


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

def make_request(zone, begin_date, end_date, source):
    response = requests.get(
        f"https://api.electricitymaps.com/v3/electricity-source/{source}/past-range?zone={zone}&start={str(begin_date)}T13%3A00%3A00.000Z&end={end_date}+14%3A00&temporalGranularity=monthly",
        headers={
            "auth-token": f"qmUpDAg9fsUxWyC2pDvp"
        }
    )
    return response

def iterate_across_time_country_source(zones, sources, begin_date, end_date):
    dates = []
    os.makedirs("Data/raw/per_countries", exist_ok=True)

    for i in range(0,end_date-begin_date+1):
        dates.append(begin_date+i)
        
    for zone, source, date in tqdm(product(zones, sources, dates)):
        start_date = str(date)+"-01-01"
        end_date = str(date)+"-12-31"
        file_name = str(zone)+"_" + str(source)+ "_" + str(start_date) + "_" + str(end_date)
        result = make_request(zone, start_date, end_date, source).json()
        with open(f'Data/raw/per_countries/{file_name}.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)


if __name__ == "__main__":
    zones = get_country_codes_json()
    with open('country_codes.json', 'w', encoding='utf-8') as f:
        json.dump(zones, f, ensure_ascii=False, indent=4)
    zones_codes = extract_country_codes(zones)

    sources = [
    "Nuclear",
    "Geothermal",
    "Biomass",
    "Coal",
    "Gas",
    "Oil",
    "Hydro",
    "Hydro Storage",
    "Wind",
    "Solar",
    "Battery Storage"]

    iterate_across_time_country_source(zones_codes, sources, 2020, 2021)

    

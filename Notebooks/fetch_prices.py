import requests
import json
from itertools import product
import os
from tqdm import tqdm

def make_request(zone, begin_date, end_date):
    response = requests.get(
    f"https://api.electricitymaps.com/v3/price-day-ahead/past-range?zone={zone}&start={begin_date}+13%3A51&end={end_date}+14%3A51&temporalGranularity=daily",
    headers={
        "auth-token": f"qmUpDAg9fsUxWyC2pDvp"
    }
    )
    return response

def iterate_across_time_country(zones, begin_date, end_date):
    dates = []
    os.makedirs("../Data/raw/per_countries/prices", exist_ok=True)

    for i in range(0,end_date-begin_date+1):
        dates.append(begin_date+i)
        
    for zone, date in tqdm(product(zones, dates)):

        os.makedirs("../Data/raw/per_countries/prices/"+ str(zone) + "/" + str(date), exist_ok=True)
        start_date = str(date)+"-01-01"
        end_date = str(date)+"-12-31"
        file_name = "price_" + str(zone)+"_" + str(start_date) + "_" + str(end_date)
        result = make_request(zone, start_date, end_date).json()
        with open(f"../Data/raw/per_countries/prices/" + str(zone) + "/" + str(date) + "/" + str(file_name) + ".json", 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)

if __name__=="__main__":
    
    europe_codes = [
    "AL",  # Albania
    "AT",  # Austria
    "AX",  # Åland Islands
    "BA",  # Bosnia and Herzegovina
    "BE",  # Belgium
    "BG",  # Bulgaria
    "BY",  # Belarus
    "CH",  # Switzerland
    "CZ",  # Czechia
    "DE",  # Germany
    "DK",  # Denmark
    "EE",  # Estonia
    "ES",  # Spain
    "FI",  # Finland
    "FO",  # Faroe Islands
    "FR",  # France
    "GB",  # Great Britain
    "GI",  # Gibraltar
    "GR",  # Greece
    "HR",  # Croatia
    "HU",  # Hungary
    "IE",  # Ireland
    "IS",  # Iceland
    "IT",  # Italy
    "LT",  # Lithuania
    "LU",  # Luxembourg
    "LV",  # Latvia
    "MD",  # Moldova
    "ME",  # Montenegro
    "MK",  # North Macedonia
    "NL",  # Netherlands
    "NO",  # Norway
    "PL",  # Poland
    "PT",  # Portugal
    "RO",  # Romania
    "RS",  # Serbia
    "SE",  # Sweden
    "SI",  # Slovenia
    "SK",  # Slovakia
    "XK"   # Kosovo
    ]
    zones = europe_codes
    
    begin_date = 2021
    end_date = 2025
    iterate_across_time_country(zones, begin_date, end_date)
    


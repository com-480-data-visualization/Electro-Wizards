from entsoe import EntsoePandasClient
import pandas as pd
import time
import os

# 1. Setup
API_KEY = '78d1d905-42db-4251-86ff-d7e4955db69f'
client = EntsoePandasClient(api_key=API_KEY)

# Define time range
start = pd.Timestamp('20180101', tz='UTC')
end = pd.Timestamp('20251231', tz='UTC')

# 2. Comprehensive Bidding Zone List (2025 Edition)
# We include legacy codes to ensure we catch the 2018 transitions
countries = [
    'AL', 'AT', 'BE', 'BG', 'CH', 'CZ', 'DE_AT_LU', 'DE_LU', 'DK_1', 'DK_2', 
    'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE_SEM', 'IT_NORTH', 'IT_CENTRE_NORTH',
    'IT_CENTRE_SOUTH', 'IT_SOUTH', 'IT_SICI', 'IT_SARD', 'LT', 'LV', 'ME', 'MK', 
    'NL', 'NO_1', 'NO_2', 'NO_3', 'NO_4', 'NO_5', 'PL', 'PT', 'RO', 'RS', 
    'SE_1', 'SE_2', 'SE_3', 'SE_4', 'SI', 'SK', 'UA'
]

# Create a folder for the data
if not os.path.exists('energy_data'):
    os.makedirs('energy_data')

# 3. Download Loop
for code in countries:
    print(f"--- Processing {code} ---")
    try:
        # entsoe-py automatically chunks requests longer than 1 year
        ts = client.query_day_ahead_prices(code, start=start, end=end)
        
        # If the data is empty or all NaN, skip saving
        if ts.empty:
            print(f"No data found for {code} in this period.")
            continue
            
        filename = f"energy_data/prices_{code}_2018_2025.csv"
        ts.to_csv(filename)
        print(f"Successfully saved {code} to {filename}")
        
        # Rate limit safety: 1 second pause between countries
        time.sleep(1)
        
    except Exception as e:
        print(f"Skipping {code}: {str(e)}")
        continue

print("\nDownload process complete. Check the 'energy_data' folder.")
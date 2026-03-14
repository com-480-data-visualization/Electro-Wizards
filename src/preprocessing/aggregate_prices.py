import pandas as pd
import glob
import os

# 1. Path to your downloaded files
path = 'energy_data'
all_files = glob.glob(os.path.join(path, "prices_*.csv"))

# This list will hold each country's individual dataframe
dataframes = []

for filename in all_files:
    # Extract country code from filename (e.g., 'prices_FR.csv' -> 'FR')
    country_code = os.path.basename(filename).split('_')[1].split('.')[0]
    
    # Read the CSV
    # header=0 (first row is header), index_col=0 (first column is the time)
    df = pd.read_csv(filename, index_col=0, header=0, names=['Time', country_code])
    
    # Convert index to datetime and force to UTC to handle DST changes safely
    df.index = pd.to_datetime(df.index, utc=True)
    
    # Remove any potential duplicates (sometimes API returns overlaps)
    df = df[~df.index.duplicated(keep='first')]
    
    dataframes.append(df)

# 2. Join all dataframes on the Time index
# 'outer' join ensures we keep timestamps even if only one country has data for that hour
master_df = pd.concat(dataframes, axis=1, join='outer')

# 3. Sort by time and save
master_df = master_df.sort_index()
master_df.to_csv('europe_prices_master_2018_2025.csv')

print(f"Successfully merged {len(dataframes)} countries into 'europe_prices_master_2018_2025.csv'")
print(master_df.head())
import pandas as pd
import glob
import os

# 1. Path to the downloaded files
path = 'energy_data'
all_files = glob.glob(os.path.join(path, "prices_*.csv"))

dataframes = []

for filename in all_files:
    country_code = os.path.basename(filename).split('_')[1].split('.')[0]
    
    df = pd.read_csv(filename, index_col=0, header=0, names=['Time', country_code])
    
    # Convert index to datetime and force to UTC to handle DST changes safely
    df.index = pd.to_datetime(df.index, utc=True)
    
    # Remove any potential duplicates
    df = df[~df.index.duplicated(keep='first')]
    
    dataframes.append(df)

# 2. Join all dataframes on the Time index
master_df = pd.concat(dataframes, axis=1, join='outer')

# 3. Sort by time and save
master_df = master_df.sort_index()
master_df.to_csv('europe_prices_master_2018_2025.csv')

print(f"Successfully merged {len(dataframes)} countries into 'europe_prices_master_2018_2025.csv'")
print(master_df.head())
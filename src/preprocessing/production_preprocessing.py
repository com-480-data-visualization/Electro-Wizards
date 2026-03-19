import pandas as pd
import json
from pathlib import Path
from tqdm import tqdm

base_folder = Path("../../Data/raw/per_countries/production")

all_dfs = []

def process_json(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        obj = json.load(f)

    # Case 1: JSON is already a list of records
    if isinstance(obj, list):
        df = pd.json_normalize(obj)

    # Case 2: JSON is a dict with a "data" field containing a list
    elif isinstance(obj, dict):
        if "data" in obj and isinstance(obj["data"], list):
            df = pd.json_normalize(obj["data"])

            # add metadata from top-level fields
            for key, value in obj.items():
                if key != "data":
                    df[key] = value

        else:
            # single-row dict
            df = pd.DataFrame([obj])

    else:
        raise ValueError(f"Unsupported JSON structure in {file_path}")

    # metadata from path
    df["country"] = file_path.parts[-3]
    df["year"] = file_path.parts[-2]

    return df

for json_file in tqdm(base_folder.rglob("*.json")):
    
    try:
        df = process_json(json_file)
        all_dfs.append(df)
    except Exception as e:
        print(f"Error with {json_file}: {e}")

final_df = pd.concat(all_dfs, ignore_index=True)
final_df.to_csv("../../Data/preprocessed/production_merged.csv")

print(final_df.head())
print(final_df.columns)
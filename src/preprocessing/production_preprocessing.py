import pandas as pd
import json
from pathlib import Path
from tqdm import tqdm

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
base_folder = PROJECT_ROOT / "Data" / "raw" / "per_countries" / "production"
output_file = PROJECT_ROOT / "Data" / "preprocessed" / "production_merged.csv"
EXCLUDED_SOURCES = {
    "battery discharge",
    "battery-discharge",
    "hydro discharge",
    "hydro-discharge",
}

all_dfs = []
error_counts = {}

def process_json(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        obj = json.load(f)

    if isinstance(obj, dict) and "error" in obj:
        raise ValueError(obj["error"])

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

    # The folder name is the zone we requested from the API. It is more
    # reliable than the payload's `zone` field for cases like GB-ORK/DK-BHM.
    zone = file_path.parts[-3]
    df["country"] = zone
    df["zone"] = zone
    df["year"] = file_path.parts[-2]

    return df.dropna(axis=1, how="all")


def centered_average_fill(series):
    values = series.copy()

    for idx in range(1, len(values) - 1):
        if pd.isna(values.iloc[idx]):
            prev_value = values.iloc[idx - 1]
            next_value = values.iloc[idx + 1]

            if pd.notna(prev_value) and pd.notna(next_value):
                values.iloc[idx] = (prev_value + next_value) / 2

    return values

for json_file in tqdm(base_folder.rglob("*.json")):
    
    try:
        df = process_json(json_file)
        all_dfs.append(df)
    except Exception as e:
        error_message = str(e)
        error_counts[error_message] = error_counts.get(error_message, 0) + 1

if not all_dfs:
    raise FileNotFoundError(
        f"No production JSON files found in {base_folder}. "
        "Check that the raw production data has been downloaded and that the path is correct."
    )

final_df = pd.concat(all_dfs, ignore_index=True)
final_df = final_df[~final_df["source"].isin(EXCLUDED_SOURCES)].copy()
final_df["datetime"] = pd.to_datetime(final_df["datetime"], utc=True, errors="coerce")
final_df = final_df.sort_values(["zone", "source", "datetime"]).reset_index(drop=True)
final_df["value"] = final_df.groupby(["zone", "source"], group_keys=False)["value"].transform(
    centered_average_fill
)
final_df = final_df.drop_duplicates(subset=["zone", "source", "datetime"], keep="first")
final_df["year"] = final_df["year"].astype(str)
final_df["datetime"] = final_df["datetime"].dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
output_file.parent.mkdir(parents=True, exist_ok=True)
final_df.to_csv(output_file, index=False)

if error_counts:
    print("Skipped files summary:")
    for error_message, count in sorted(error_counts.items()):
        print(f"- {count} files: {error_message}")

print(final_df.head())
print(final_df.columns)

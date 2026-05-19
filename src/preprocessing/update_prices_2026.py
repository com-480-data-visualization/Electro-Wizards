"""Pull the latest day-ahead prices from ENTSO-E (since the last row in
aggregated_prices.csv) and merge them in.

The header of aggregated_prices.csv contains duplicate country codes that map
to specific bidding zones in this order (per the original
src/preprocessing/get_prices.py download list):

    HR, SE_1, GR, IT_NORTH, PL, SE_2, FR, IE_SEM, HU, RS,
    FI, NO_2, SK, LV, DK_1, DE_AT_LU, RO, DE_LU, BG, DK_2,
    NO_3, PT, LT, ES, SI, NO_5, NO_4, EE, NO_1, NL,
    ME, BE, SE_3, CH, MK, CZ, IT_CENTRE_NORTH, AT, SE_4

We fetch each of these zones for the requested window and append the new rows
to aggregated_prices.csv in the same column order.
"""
from __future__ import annotations
import time
from pathlib import Path
import pandas as pd
from entsoe import EntsoePandasClient

API_KEY = "78d1d905-42db-4251-86ff-d7e4955db69f"
ROOT = Path(__file__).resolve().parents[2]
CSV = ROOT / "Data" / "preprocessed" / "aggregated_prices.csv"

# Column-order = the original download order; index = column position (0-based excluding Time).
ZONE_ORDER = [
    "HR", "SE_1", "GR", "IT_NORD", "PL", "SE_2", "FR", "IE_SEM", "HU", "RS",
    "FI", "NO_2", "SK", "LV", "DK_1", "DE_AT_LU", "RO", "DE_LU", "BG", "DK_2",
    "NO_3", "PT", "LT", "ES", "SI", "NO_5", "NO_4", "EE", "NO_1", "NL",
    "ME", "BE", "SE_3", "CH", "MK", "CZ", "IT_CNOR", "AT", "SE_4",
]


def main():
    df_existing = pd.read_csv(CSV, parse_dates=["Time"])
    last_existing = df_existing["Time"].max()
    print(f"Existing CSV ends at {last_existing}")

    # Start the day after the last existing timestamp (drop the second so we
    # land cleanly on a day boundary and avoid duplicates).
    start = (last_existing + pd.Timedelta(hours=1)).floor("H")
    end = pd.Timestamp.utcnow().floor("H")
    print(f"Fetching {start} → {end}")

    if end <= start:
        print("Nothing to do.")
        return

    client = EntsoePandasClient(api_key=API_KEY)

    # The existing CSV columns AFTER Time correspond to ZONE_ORDER. Validate.
    existing_cols = df_existing.columns.tolist()[1:]
    assert len(existing_cols) == len(ZONE_ORDER), \
        f"Column count mismatch: csv={len(existing_cols)} vs zones={len(ZONE_ORDER)}"

    # Fetch each zone (cache by zone to avoid duplicate fetches when the
    # column-header order has duplicates from concat duplication, even though
    # ZONE_ORDER itself should be unique).
    cache: dict[str, pd.Series] = {}
    for zone in ZONE_ORDER:
        if zone in cache:
            continue
        print(f"  -- fetching {zone}")
        try:
            s = client.query_day_ahead_prices(zone, start=start, end=end)
            cache[zone] = s
        except Exception as e:
            print(f"     skipped {zone}: {e}")
            cache[zone] = pd.Series(dtype=float)
        time.sleep(1)  # be polite

    # Build the new frame in the exact ZONE_ORDER, but using existing csv
    # column labels (so duplicates stay duplicated).
    # First, determine the shared time index from any non-empty series.
    non_empty = [s for s in cache.values() if not s.empty]
    if not non_empty:
        print("All fetches returned empty; nothing to write.")
        return
    shared_index = sorted({t for s in non_empty for t in s.index})
    shared_index = pd.DatetimeIndex(shared_index)
    if shared_index.tz is None:
        shared_index = shared_index.tz_localize("UTC")
    else:
        shared_index = shared_index.tz_convert("UTC")

    new_frames = []
    for col_label, zone in zip(existing_cols, ZONE_ORDER):
        s = cache[zone]
        if s.empty:
            import numpy as np
            s = pd.Series(np.nan, index=shared_index, dtype="float64")
        else:
            if s.index.tz is None:
                s.index = s.index.tz_localize("UTC")
            else:
                s.index = s.index.tz_convert("UTC")
            s = s.reindex(shared_index)
        s.name = col_label
        new_frames.append(s)
    new_df = pd.concat(new_frames, axis=1)
    new_df.index.name = "Time"

    # Drop any timestamps that are already in the existing CSV (safety belt).
    existing_times = set(df_existing["Time"].astype(str))
    new_df = new_df[~new_df.index.astype(str).isin(existing_times)]
    if new_df.empty:
        print("No new rows after dedup; nothing to write.")
        return

    print(f"Appending {len(new_df)} new rows.")
    # Append to the CSV without writing the header again.
    new_df.reset_index().to_csv(CSV, mode="a", header=False, index=False)
    print(f"Done. CSV now ends at {new_df.index.max()}.")


if __name__ == "__main__":
    main()

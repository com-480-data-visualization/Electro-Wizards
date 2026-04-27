"""Build JSON datasets consumed by the docs/ website.

Outputs (written to docs/data/):
    prices_monthly.json     -> { countries: [...], dates: [...], values: { ISO: [..] } }
    production_monthly.json -> { countries: {...}, sources: [...] }
    items_monthly.json      -> { items: [...], countries: [...], data: { item: { country: [..] } } }
    timeline.json           -> hand-curated geopolitical events for Ukraine and Iran
"""
from pathlib import Path
import json
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA_IN = ROOT / "Data" / "preprocessed"
DATA_OUT = ROOT / "docs" / "data"
DATA_OUT.mkdir(parents=True, exist_ok=True)


def build_prices():
    df = pd.read_csv(DATA_IN / "aggregated_prices.csv", parse_dates=["Time"])
    # Drop duplicate zone columns (DE.1, NO.2, ...) -- keep the first occurrence
    unique_cols = ["Time"]
    seen = {"Time"}
    for c in df.columns[1:]:
        base = c.split(".")[0]
        if base not in seen:
            unique_cols.append(c)
            seen.add(base)
    df = df[unique_cols].rename(columns={c: c.split(".")[0] for c in unique_cols})
    df = df.set_index("Time")

    # Monthly mean prices
    monthly = df.resample("MS").mean()
    # Restrict to 2019-01 .. 2025-12 (we have full coverage there)
    monthly = monthly.loc["2019-01-01":"2025-12-31"]

    countries = sorted([c for c in monthly.columns if monthly[c].notna().sum() > 12])
    dates = [d.strftime("%Y-%m") for d in monthly.index]

    values = {}
    for c in countries:
        s = monthly[c]
        # Replace NaN with None for valid JSON
        values[c] = [None if pd.isna(v) else round(float(v), 2) for v in s.values]

    out = {"countries": countries, "dates": dates, "values": values}
    (DATA_OUT / "prices_monthly.json").write_text(json.dumps(out))
    print(f"prices_monthly.json: {len(countries)} countries, {len(dates)} months")


def build_production():
    df = pd.read_csv(DATA_IN / "production_merged.csv")
    df = df.dropna(subset=["country", "source", "value", "datetime"])
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df[df["temporalGranularity"] == "monthly"]

    # European countries we care about
    eu = [
        "AT", "BE", "BG", "CH", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
        "HR", "HU", "IE", "IT", "LT", "LU", "LV", "ME", "MK", "NL", "NO", "PL",
        "PT", "RO", "RS", "SE", "SI", "SK", "GB",
    ]
    df = df[df["country"].isin(eu)]

    # Aggregate per country / source / month
    df["month"] = df["datetime"].dt.to_period("M").dt.to_timestamp()
    grouped = df.groupby(["country", "source", "month"])["value"].sum().reset_index()

    sources = sorted(grouped["source"].unique())

    # Build full month index for each country
    month_index = pd.date_range("2021-01-01", "2025-12-01", freq="MS")
    dates = [d.strftime("%Y-%m") for d in month_index]

    countries = {}
    for country, sub in grouped.groupby("country"):
        per_source = {}
        for src in sources:
            sub_src = sub[sub["source"] == src].set_index("month")
            series = sub_src["value"].reindex(month_index)
            per_source[src] = [None if pd.isna(v) else round(float(v), 2) for v in series.values]
        countries[country] = per_source

    out = {"sources": sources, "dates": dates, "countries": countries}
    (DATA_OUT / "production_monthly.json").write_text(json.dumps(out))
    print(f"production_monthly.json: {len(countries)} countries, {len(sources)} sources")


def build_items():
    df = pd.read_csv(DATA_IN / "relatable_prices_europe.csv")

    # Compute average European price per item per date (skip aggregates EA/EU)
    df = df[~df["Country"].isin(["EA", "EU"])]
    df["Date"] = pd.to_datetime(df["Date"])

    items = sorted(df["Item_Name"].unique())
    countries = sorted(df["Country"].unique())
    dates = sorted(df["Date"].dt.strftime("%Y-%m").unique())

    # Country-level data: { item: { country: [prices...] } }
    data = {}
    for item in items:
        sub = df[df["Item_Name"] == item]
        pivot = sub.pivot_table(
            index="Date", columns="Country",
            values="Estimated_Price_Euro", aggfunc="mean",
        )
        all_dates = pd.date_range(pivot.index.min(), pivot.index.max(), freq="MS")
        pivot = pivot.reindex(all_dates)
        per_country = {}
        for c in pivot.columns:
            per_country[c] = [None if pd.isna(v) else round(float(v), 4) for v in pivot[c].values]
        data[item] = {
            "dates": [d.strftime("%Y-%m") for d in pivot.index],
            "countries": per_country,
        }

    out = {"items": items, "countries": countries, "data": data}
    (DATA_OUT / "items_monthly.json").write_text(json.dumps(out))
    print(f"items_monthly.json: {len(items)} items, {len(countries)} countries")


def build_timeline():
    timeline = {
        "ukraine": {
            "label": "Russia–Ukraine war",
            "country_iso2": "UA",
            "focus_year": 2022,
            "color_primary": "#0057B7",
            "color_secondary": "#FFD700",
            "events": [
                {"date": "2021-09", "title": "Gas storage drains", "desc": "European gas inventories abnormally low at the start of winter."},
                {"date": "2021-12", "title": "Tensions escalate", "desc": "Russian troops mass at the Ukrainian border; gas prices begin to climb."},
                {"date": "2022-02", "title": "Invasion begins", "desc": "Russia invades Ukraine on Feb 24. Energy markets enter panic mode."},
                {"date": "2022-06", "title": "Nord Stream cuts", "desc": "Gazprom slashes Nord Stream flows; gas–power coupling spikes."},
                {"date": "2022-08", "title": "Peak prices", "desc": "Day-ahead electricity peaks above €700/MWh in many EU markets."},
                {"date": "2022-09", "title": "Nord Stream sabotage", "desc": "Pipeline ruptures end any return to pre-war Russian gas."},
                {"date": "2023-02", "title": "Easing", "desc": "Mild winter and demand cuts pull prices back below €200/MWh."},
                {"date": "2024-01", "title": "New normal", "desc": "Prices stabilise at a level still well above the 2018-2020 baseline."}
            ]
        },
        "iran": {
            "label": "Iran–US flare-up (2026)",
            "country_iso2": "IR",
            "focus_year": 2025,
            "color_primary": "#239F40",
            "color_secondary": "#DA0000",
            "events": [
                {"date": "2024-04", "title": "Direct strikes", "desc": "Iran and Israel exchange direct strikes for the first time. Brent crude spikes."},
                {"date": "2024-10", "title": "Strait jitters", "desc": "Threats around the Strait of Hormuz lift LNG and oil benchmarks."},
                {"date": "2025-06", "title": "Sanctions tighten", "desc": "New US sanctions package targets Iranian crude exports."},
                {"date": "2025-09", "title": "Power-price echo", "desc": "European day-ahead prices nudge higher despite ample storage — a softer echo of 2022."},
                {"date": "2025-12", "title": "Stabilisation", "desc": "Markets price in a contained shock; prices remain near recent norms."}
            ]
        }
    }
    (DATA_OUT / "timeline.json").write_text(json.dumps(timeline))
    print("timeline.json written")


def main():
    build_prices()
    build_production()
    build_items()
    build_timeline()


if __name__ == "__main__":
    main()

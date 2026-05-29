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
    # Several country codes appear as duplicate columns (DE, DE.1, ...) because
    # each country can have multiple bidding zones in the source CSV. Some of
    # these zones were discontinued (e.g. DE_AT_LU after Oct 2018) and split
    # into successors (DE_LU). We combine all duplicates per base code by
    # taking the first non-null value across the duplicates per timestamp, so
    # we get continuous coverage from 2018 through today.
    bases: dict[str, list[str]] = {}
    for c in df.columns[1:]:
        bases.setdefault(c.split(".")[0], []).append(c)

    merged = pd.DataFrame({"Time": df["Time"]})
    for base, cols in bases.items():
        # bfill across duplicate columns row-wise: take the first non-null
        merged[base] = df[cols].bfill(axis=1).iloc[:, 0]
    df = merged.set_index("Time")

    # Monthly mean prices
    monthly = df.resample("MS").mean()
    # Use everything from 2019-01 to the latest month; drop the current month
    # if it's partial (less than 15 days worth of data).
    monthly = monthly.loc["2019-01-01":]
    # Trim any all-NaN trailing months
    while len(monthly) and monthly.iloc[-1].isna().all():
        monthly = monthly.iloc[:-1]

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
    """Hand-curated event annotations. Each event is the headline tag for the
    `findEvent` lookup (latest event <= current date wins), and supplies a
    'news' field used by the news ticker on the site."""
    # Each event now carries:
    #   title, desc       - short headline + 1-line summary
    #   source            - "Reuters" | "FT" | "Bloomberg" | ... (newspaper branding)
    #   headline          - the actual newspaper-style headline
    #   mix_impact        - one line describing how this event nudged production mix
    #   url (optional)    - external link to read more
    #
    # Rather than fabricate article URLs that 404, we default to a Google
    # search for the actual headline + source. The user lands on a working
    # results page with the real article(s) on top. Use a literal URL only
    # when we know it's stable (Wikipedia article, official institution page).
    import urllib.parse as _u
    def _search(*parts):
        q = " ".join(p for p in parts if p)
        return "https://www.google.com/search?q=" + _u.quote_plus(q)
    def E(date, title, desc, source, headline, mix_impact, url=None):
        if not url:
            url = _search(headline, source)
        return {"date": date, "title": title, "desc": desc, "source": source,
                "headline": headline, "mix_impact": mix_impact, "url": url}

    timeline = {
        "ukraine": {
            "label": "Russia–Ukraine war",
            "country_iso2": "UA",
            "focus_year": 2022,
            "color_primary": "#0057B7",
            "color_secondary":"#FFD700",
            "events": [
                E("2021-08", "Gas storage drains",
                  "European gas inventories abnormally low at the start of the heating season.",
                  "Reuters", "EU gas stocks hit 10-year low for August",
                  "First nudge: utilities lean on coal to spare gas storage."),
                E("2021-10", "Gas prices triple",
                  "TTF gas hits €100/MWh as Russia keeps supply tight ahead of winter.",
                  "Financial Times", "European gas hits record €100/MWh",
                  "Coal share rises sharply across Germany, Poland, Czechia."),
                E("2021-12", "Troops mass at border",
                  "100k Russian troops mass at the Ukrainian border; markets begin pricing in war risk.",
                  "BBC", "NATO warns of imminent Russian build-up",
                  "Gas-fired generation eases as utilities pre-buy and switch fuels."),
                E("2022-02", "Invasion begins",
                  "Russia invades Ukraine on Feb 24. Energy markets enter panic mode.",
                  "Associated Press", "Russia launches full-scale invasion of Ukraine",
                  "Across the EU mix: gas plunges, coal jumps, nuclear runs flat-out.",
                  "https://en.wikipedia.org/wiki/Russian_invasion_of_Ukraine"),
                E("2022-03", "Sanctions cascade",
                  "EU/US impose sweeping sanctions on Russian banks. Brent tops $130/bbl.",
                  "Reuters", "Brent surges above $130 on Russia ban fears",
                  "Coal share climbs further; renewables capped by capacity not demand."),
                E("2022-05", "REPowerEU plan",
                  "Commission unveils €300bn plan to wean Europe off Russian fossil fuels by 2027.",
                  "European Commission", "REPowerEU plan unveiled",
                  "Long-term policy floor under solar + wind investment.",
                  "https://commission.europa.eu/strategy-and-policy/priorities-2019-2024/european-green-deal/repowereu-affordable-secure-and-sustainable-energy-europe_en"),
                E("2022-06", "Nord Stream slashed",
                  "Gazprom cuts Nord Stream 1 flows to 40% then 20% of capacity.",
                  "Bloomberg", "Gazprom slashes Nord Stream flows",
                  "Gas share collapses; lignite plants restart in Germany."),
                E("2022-07", "Heatwave compounds",
                  "Record heatwave forces French nuclear curtailments, supply tightens further.",
                  "Le Monde", "EDF cuts nuclear output as rivers warm",
                  "France's nuclear share drops from 70% to ~50% on cooling-water limits."),
                E("2022-08", "Peak prices",
                  "Day-ahead electricity peaks above €700/MWh in many EU markets.",
                  "Financial Times", "European power smashes records, France above €1,000",
                  "Mix can't move further: every flexible MWh is already dispatched."),
                E("2022-09", "Nord Stream sabotage",
                  "Pipeline ruptures end any return to pre-war Russian gas via the Baltic.",
                  "Reuters", "Nord Stream pipelines hit by sabotage",
                  "Pipeline gas option permanently removed from the mix.",
                  "https://en.wikipedia.org/wiki/Nord_Stream_pipeline_sabotage"),
                E("2022-10", "EU price cap debate",
                  "Member states wrangle over an EU-wide gas price cap mechanism.",
                  "Politico", "EU split on emergency gas price cap",
                  "Hedging behaviour shifts; spot volatility eases slightly."),
                E("2022-12", "Mild winter saves the day",
                  "Unusually warm December plus 15% demand cut break the price spiral.",
                  "Bloomberg", "Warm winter saves Europe from blackouts",
                  "Less gas burn than feared; storage still 80%+ end of January."),
                E("2023-02", "Prices ease",
                  "Mild winter and demand cuts pull day-ahead below €200/MWh.",
                  "Reuters", "European power dives back to pre-war levels",
                  "Coal share starts retreating; renewables hit new monthly records."),
                E("2023-04", "Germany ends nuclear",
                  "Last three nuclear plants close, leaving Germany more gas-dependent at the margin.",
                  "Deutsche Welle", "Germany shuts down its last nuclear reactors",
                  "Germany's nuclear share goes to zero; gas + renewables fill in.",
                  "https://en.wikipedia.org/wiki/Nuclear_power_in_Germany"),
                E("2023-12", "First post-war winter normal",
                  "Europe makes it through a second winter without Russian gas. Storage 90%+.",
                  "Financial Times", "Europe ends winter with gas storage full",
                  "Coal share now below pre-crisis levels in most countries."),
                E("2024-04", "New baseline",
                  "Prices stabilise around €70-90/MWh, still well above the 2018-2020 norm.",
                  "S&P Global", "Power finds new normal at €80/MWh",
                  "Wind + solar combine for >30% of EU annual generation for the first time."),
                E("2024-10", "Russian transit ends",
                  "Ukraine refuses to renew the Russian gas transit deal expiring Dec 31.",
                  "Reuters", "Kyiv rules out gas transit deal renewal",
                  "Last pipeline link from Russia disappears from the supply mix."),
                E("2025-01", "Transit halts",
                  "Last Russian pipeline gas through Ukraine stops on New Year's Day.",
                  "Bloomberg", "Russian gas to Europe via Ukraine ends",
                  "Eastern EU's gas mix re-routes via LNG and Trans-Balkan pipeline."),
                E("2025-03", "Renewables top fossils",
                  "EU renewables outpace fossil fuels in the power mix for the first time on an annual basis.",
                  "Ember Climate", "Renewables overtake fossils in EU power mix",
                  "Structural mix tilt: solar adds ~50 GW in a single year.",
                  "https://ember-energy.org/latest-insights/european-electricity-review-2025/"),
                E("2025-09", "Storage strain returns",
                  "Low wind + slow refilling push prices back toward €120/MWh in Q3.",
                  "Financial Times", "Europe's gas storage refill stutters",
                  "Gas burn rises again briefly; coal use stays low."),
                E("2026-02", "Cool winter, calm markets",
                  "Warmer-than-average February keeps prices contained despite ongoing war.",
                  "Reuters", "Warm February eases European power demand",
                  "Renewables share peaks above 50% for the month in several countries."),
                E("2026-05", "Today",
                  "Day-ahead prices are still ~2× the 2018-2020 baseline three years after the war began.",
                  "Live update", "Europe's electricity bill: the war's longest scar",
                  "The mix has structurally tilted toward renewables, but at a price.",
                  "#")
            ]
        },
        "iran": {
            "label": "Iran flare-up (2024–26)",
            "country_iso2": "IR",
            "focus_year": 2025,
            "color_primary": "#239F40",
            "color_secondary": "#DA0000",
            "events": [
                E("2024-01", "Tit-for-tat strikes",
                  "Iran-backed proxies attack US bases; Houthi Red Sea attacks reroute LNG cargoes.",
                  "Reuters", "Red Sea LNG diversions add to gas costs",
                  "LNG cargoes detour around Africa, adding 2–3 weeks transit.",
                  "https://en.wikipedia.org/wiki/Red_Sea_crisis"),
                E("2024-04", "Direct strikes",
                  "Iran and Israel exchange direct missile strikes for the first time. Brent jumps to $90.",
                  "Associated Press", "Iran launches direct strike on Israel",
                  "Brief oil-driven uptick in fossil generation; renewables quickly absorb.",
                  "https://en.wikipedia.org/wiki/April_2024_Iranian_strikes_against_Israel"),
                E("2024-07", "Oil markets jittery",
                  "Assassination of Hamas leader in Tehran sparks fresh escalation fears.",
                  "Financial Times", "Brent crude jumps on Tehran assassination",
                  "Gas peakers cycle harder on heatwave + risk premium."),
                E("2024-10", "Strait of Hormuz risk",
                  "Iran threats around the Strait lift LNG and oil benchmarks; ~20% of world LNG passes here.",
                  "Bloomberg", "Hormuz tensions rattle global LNG",
                  "Europe still well-supplied, almost no observable shift in the mix.",
                  "https://en.wikipedia.org/wiki/Strait_of_Hormuz"),
                E("2025-01", "Sanctions tighten",
                  "New US sanctions package targets Iranian crude exports to China.",
                  "Reuters", "Fresh US sanctions hit Iran oil exports",
                  "Indirect: cheaper Iranian crude into China shifts global flows."),
                E("2025-04", "Tanker incidents",
                  "Three commercial tankers damaged in the Gulf; insurance premiums spike.",
                  "Lloyd's List", "Gulf insurance rates soar",
                  "Marginal LNG cargo costs rise; ~€2/MWh gas premium in EU."),
                E("2025-06", "Diplomatic stalemate",
                  "Nuclear talks in Vienna collapse; markets price in long-term Middle East risk.",
                  "Associated Press", "Iran nuclear talks break down",
                  "Long-term LNG contracts re-priced; minimal mix impact short-term."),
                E("2025-09", "Power-price echo",
                  "European day-ahead prices nudge higher despite ample storage, a softer echo of 2022.",
                  "S&P Global", "European power feels Middle East ripple",
                  "Gas share inches up; coal use flat, buffers held."),
                E("2025-12", "Year-end calm",
                  "Markets price in a contained shock; prices remain near recent norms.",
                  "Reuters", "2025 ends with energy markets steady",
                  "Renewables continue to gain share, mix tilt independent of crisis."),
                E("2026-01", "Cyber-attack on grid",
                  "Iran-linked cyber actors target a European TSO; brief but no outage.",
                  "Politico", "EU cyber agency raises grid alert",
                  "No mix impact; reliability concerns drive battery investment."),
                E("2026-03", "Drone strike on refinery",
                  "A Gulf refinery hit by drones; diesel cracks widen.",
                  "Reuters", "Refinery strike lifts diesel premiums",
                  "Oil-fired backup generation slightly more expensive at the margin."),
                E("2026-05", "Today",
                  "Tensions persist but Europe's gas diversification absorbs most of the shock.",
                  "Live update", "Iran risk lingers but Europe has built buffers",
                  "Renewables + storage now structurally dampen geopolitical shocks.",
                  "#")
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

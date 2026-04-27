# Power & Conflict — How geopolitics rewires Europe's electricity

[![COM-480](https://img.shields.io/badge/COM--480-Data%20Visualization-blue)](https://com-480-data-visualization.github.io/Electro-Wizards/)

An interactive scrollytelling experience exploring how the **Russia–Ukraine war** and the **2024–2026 Iran flare-up** rippled through European electricity markets — and ended up on supermarket shelves.

> Live site: <https://com-480-data-visualization.github.io/Electro-Wizards/>

| Student          | SCIPER  |
|------------------|---------|
| Christopher Soriano | 326354  |
| Timothé Henri Robert Dard | 340944  |

## What's in here

```
.
├── docs/                       # The website (served from GitHub Pages)
│   ├── index.html
│   ├── css/style.css
│   ├── js/                     # One small ES module per visualization
│   │   ├── data.js             # data loader + shared store
│   │   ├── intro.js            # hero canvas
│   │   ├── choice.js           # conflict picker
│   │   ├── map.js              # choropleth + time slider
│   │   ├── production.js       # stacked-area mix
│   │   ├── shelf.js            # interactive pantry
│   │   ├── receipt.js          # printable conflict receipt
│   │   └── main.js             # reveal-on-scroll glue
│   └── data/                   # Pre-baked JSON the website consumes
├── src/
│   ├── preprocessing/          # Original raw → preprocessed pipeline
│   ├── exploratory_analysis/
│   └── website_data/           # Build the docs/data/*.json files
│       └── build_website_data.py
├── Data/
│   ├── raw/
│   └── preprocessed/
├── Notebooks/                  # EDA notebooks
├── Milestone_1_Report.pdf
├── Milestone_2_Report.pdf
├── Milestone 3.pdf
└── Website Preliminary Design.pdf
```

## The story we tell

1. **Hero** — a quiet "stable" backdrop with the thesis: *when the world cracks, the lights flicker*.
2. **Pick a shock** — Ukraine (2022) or Iran (2024–26). The whole site re-skins to that conflict's flag colours and loads its event timeline.
3. **Europe priced in shock waves** — choropleth of monthly day-ahead electricity prices for ~30 European countries from 2019 → 2025. Drag the slider or hit play; the map tints from teal (cheap) → yellow → red (peak crisis). Annotated events appear on the right.
4. **The energy mix shifts under pressure** — stacked-area chart of monthly production by source for any country. Toggle absolute vs. share, click legend dots to mute sources. A "shock" marker shows when the conflict began. A short auto-generated takeaway tells the user what changed.
5. **The shock landed in your pantry** — a hand-drawn-feel shelf of 9 everyday item categories (bread, dairy, meat, oils, fruit, veg, sugar, coffee, electricity). Hover any item for a tooltip with before/peak/latest prices and a sparkline. Click items to drop them in your basket.
6. **Your conflict receipt** — a printer-style receipt of the basket showing what you would have paid before the shock, at peak, and today, with the war's added cost spelled out.

## Run it locally

```bash
cd docs
python3 -m http.server 8765
# then open http://localhost:8765
```

That's it — the site is plain HTML/CSS/vanilla-JS plus D3.js loaded from a CDN. No build step.

## Rebuild the data files

The website consumes four JSON files in `docs/data/`. Regenerate them from `Data/preprocessed/*.csv` with:

```bash
python3 src/website_data/build_website_data.py
```

This produces:

- `prices_monthly.json` — monthly day-ahead prices, 29 European countries, 2019-2025
- `production_monthly.json` — monthly production by source, 31 European countries, 2021-2025
- `items_monthly.json` — Eurostat HICP-derived consumer prices for 9 product categories
- `timeline.json` — annotated events for each conflict

## Tech stack

- **HTML / CSS / vanilla JavaScript** — no framework, no bundler.
- **D3.js v7** — geo-projection, scales, axes, area generator, transitions.
- **topojson-client** — decoding the world map from `world-atlas`.
- **Python / pandas** — offline data preparation.

## Data sources

| Dataset | Source | Coverage |
|---|---|---|
| Day-ahead electricity prices | [ENTSO-E Transparency Platform](https://transparency.entsoe.eu/) | 2018-2025, hourly → resampled monthly |
| Production by source | [ElectricityMaps API](https://api.electricitymaps.com/) | 2021-2025, monthly |
| Consumer prices (HICP) | Eurostat | 2021-2025, monthly |

## Milestones

- [Milestone 1 report](Milestone_1_Report.pdf) — problematic, datasets, EDA
- [Milestone 2 report](Milestone_2_Report.pdf) — tools, architecture, sketches
- [Milestone 3 brief](Milestone%203.pdf) — final deliverable spec

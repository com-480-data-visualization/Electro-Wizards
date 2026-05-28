# Power & Conflict — How geopolitics rewires Europe's electricity

[![COM-480](https://img.shields.io/badge/COM--480-Data%20Visualization-blue)](https://com-480-data-visualization.github.io/Electro-Wizards/)

An interactive scrollytelling experience exploring how the **Russia–Ukraine war** and the **2024–2026 Iran flare-up** rippled through European electricity markets — and ended up on supermarket shelves.

> Live site: <https://com-480-data-visualization.github.io/Electro-Wizards/>

| Student          | SCIPER  |
|------------------|---------|
| Christopher Soriano | 326354  |
| Timothé Henri Robert Dard | 340944  |

## Git detail

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

## How to use our webiste

The page is meant to be used by scrolling from top to bottom. Some parts of the story only become active after you make a choice, so it is best to follow the order of the sections.

## 1. Start the story

Begin on the landing page and scroll down, or click **Begin**.

## 2. Choose a conflict

In the conflict section, choose one of the two stories:

* **Russia–Ukraine**
* **Iran flare-up**

Click on the flag of the conflict you want to follow.

After you choose a conflict, the rest of the website adapts to that choice. The map, explanations, shelf, and receipt will be based on the selected conflict.

## 3. Explore the electricity price map

The map shows European countries coloured by their monthly day-ahead electricity price.

Use the **timeline slider** to move through time. As you drag the slider, the map updates to show how prices changed month by month.

You can also click on a country. This opens a small country view and lets you continue the story for that specific country.

On the side, you can see the **top 10 most expensive grids**. This ranking updates when the timeline changes.

## 4. Look at the energy mix

After selecting a country, continue to the energy mix section.

This part shows how the country produced electricity over time. You can use it to see whether the country relied more on gas, coal, renewables, nuclear, or other sources during the selected period.

There are two ways to view the chart:

* **Absolute**: shows the amount of electricity produced by each source.
* **Share of mix**: shows the percentage contribution of each source.

Hover over the chart to inspect values more closely.

The chart is linked to the selected country, so if you choose another country on the map, this section updates too.

## 5. Use the grocery shelf

The shelf connects the energy story to everyday life.

The prices shown depend on the selected country and the date chosen with the timeline slider. Hover over an item to see how its price changed over time.

Click on items to add them to your basket.

## 6. Check your receipt

Once you have added items from the shelf, scroll to the receipt section.

The receipt compares what your basket would have cost:

* before the shock,
* at the peak,
* and at the selected date.

This helps show how a conflict can move from energy markets into consumer prices.

You can clear the basket and try again with different items.

## 7. Compare the two conflicts

Near the end, the website compares the two crises side by side.

The timelines are aligned around the shock month, so you can compare how strongly each conflict affected European electricity prices.

This section is useful for seeing that not all conflicts have the same effect. The Russia–Ukraine shock had a much stronger impact on European electricity markets, while the Iran-related shock appears smaller in the data shown on the website.

## 8. Restart if needed

Use the **Reset** button or return to the top of the page if you want to choose another conflict and explore the story again.

## Data used

The website uses electricity prices, electricity production data, and consumer price indices. The main sources mentioned on the page are:

* ENTSO-E for day-ahead electricity prices,
* ElectricityMaps for electricity production mix,
* Eurostat HICP for consumer price data.

## Rebuild the data files

The website consumes four JSON files in `docs/data/`. Regenerate them from `Data/preprocessed/*.csv` with:

```bash
python3 src/website_data/build_website_data.py
```

This produces:

- `prices_monthly.json`: monthly day-ahead prices, 29 European countries, 2019-2025
- `production_monthly.json`: monthly production by source, 31 European countries, 2021-2025
- `items_monthly.json`: Eurostat HICP-derived consumer prices for 9 product categories
- `timeline.json`: annotated events for each conflict

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

# Power & Conflict — Process Book

**Electro-Wizards · COM-480 · Milestone 3 · May 2026**

Christopher Soriano (326354) · Timothé Henri Robert Dard (340944)

---

## 1 · Where we started

When we first sat down for Milestone 1, the original brief sounded almost too
ambitious to us: *"show how geopolitical conflicts affect the supply and demand
of electricity in the world."* Energy markets are notoriously hard to read —
half data, half geopolitics, half weather — and we knew the only way to make
the topic land was to **tell a story** rather than dump charts.

Our hypothesis was simple: when a conflict surges, especially in or around a
major energy producer, the countries that depend on that producer see it in
both how they generate electricity and how much they pay for it. The 2022
invasion of Ukraine and the 2024–2026 Iran flare-up were obvious candidates —
both real, both recent, both touching different parts of Europe's energy
supply chain.

The audience we wanted to reach was the same young / mid-career, broadly
educated reader who reads *The Economist* on the way to work but doesn't open
ENTSO-E day-ahead price feeds for fun. That informed almost every design
decision down the line: prioritise narrative, avoid jargon, anchor every
number in a concrete consequence (your electricity bill, your shopping
trolley).

---

## 2 · The original sketch

The very first sketch (reproduced from Milestone 2) was a three-screen
scrollytelling experience:

1. A split-screen portal where the user picks a conflict by clicking a flag.
2. A heatmap of European electricity prices with a time slider.
3. A grocery-shop shelf showing how everyday item prices were affected.

```
   ┌───────────────────────┐    ┌───────────────────────┐
   │   Pick a conflict     │ →  │   Map + time slider   │ →  ┌───────────┐
   │   🇺🇦  vs  🇮🇷           │    │   (heatmap of prices) │    │   shelf    │
   └───────────────────────┘    └───────────────────────┘    └───────────┘
```

Looking back, that sketch was the right skeleton — the final website still has
all three screens in that order. But once we started building, the gaps in the
plan became obvious very quickly.

---

## 3 · Datasets and the first dose of reality

We ended up working with **three** datasets:

| Dataset | Source | What it gave us |
|---|---|---|
| Day-ahead electricity prices | ENTSO-E Transparency Platform | Hourly EUR/MWh for ~30 European bidding zones, 2018 → today |
| Production by source | ElectricityMaps API | Monthly MWh per source per country, 2021 → 2025 |
| Consumer prices (HICP) | Eurostat | Monthly index for 9 product categories (bread, dairy, meat…), 2021 → 2025 |

The data sounded clean. It wasn't.

- **ENTSO-E** returns prices per *bidding zone*, not per country. France is `FR`,
  but Italy has six sub-zones, Norway five, Sweden four, Germany has two with a
  legacy zone (`DE_AT_LU`) that was discontinued in October 2018 and split into
  `DE_LU` and `AT`. Our first pass at the merged CSV had Germany blank for the
  last seven years because we were reading the discontinued zone column. We
  only spotted this when the 2022 map showed Germany still pale green at peak
  crisis — clearly wrong. The fix was to collapse all duplicate columns per
  country and take the first non-null value per timestamp (see
  [`src/website_data/build_website_data.py`](src/website_data/build_website_data.py),
  function `build_prices`).
- **ElectricityMaps** mixes country-level codes (`FR`, `DE`) with sub-regional
  codes (`AU-NSW`, `US-CAL-CISO`, `IT-SAR`) and even some that we never
  managed to identify. Filtering down to ~30 European countries was easy;
  matching the ENTSO-E codes to the ElectricityMaps codes was where we
  burned an evening.
- **Eurostat HICP** publishes an *index* (anchored at 2015 = 100), not a euro
  price. We anchored each item to a plausible 2015 retail price (e.g. bread at
  €1.25/kg) and multiplied the index through, so the website shows euros and
  cents rather than abstract index points. That was a deliberate trade-off
  toward "relatable" over "precise" — we flag it in the receipt footer.

The take-away for us was: **plan for data cleaning to take twice as long as you
think it will**, and **always sanity-check at the visual layer**, not just at
the pandas layer. A spot-check of "is Germany red in 2022?" caught a bug that
no `df.describe()` ever would have.

---

## 4 · From a static skeleton to a real story

Our Milestone 2 deliverable was a plain HTML skeleton: three static pages, a
slider that just updated a `<div>`, and a hard-coded D3 map with one fixed
colour. It was enough to validate the layout, but it had no story arc and no
state.

The real work between Milestone 2 and Milestone 3 was answering a sequence of
"what next?" questions, each of which produced a new module.

### 4.1 · A single source of truth

The first thing we did was throw away every `document.getElementById(...)` we
had and replace them with a tiny reactive store living in
[`js/data.js`](docs/js/data.js):

```js
PC.state = { conflict, monthIndex, basket, shelfCountry, prodCountry, ... };
PC.set({ monthIndex: 42 });         // mutates + fires listeners
PC.on("monthIndex", (idx) => ...);  // subscribe
```

It is 30 lines of code. We didn't want a framework — the whole point of the
course was to learn D3 — but we did want a single place where everything that
*could* change was tracked, so that the map, the production chart, the shelf
and the receipt could all react to the same slider. That decision unlocked the
rest of the project; without it we would have spent another week wiring DOM
listeners.

### 4.2 · The scroll-lock state machine

Early prototypes let the user free-scroll the whole page, even before picking
a conflict. We noticed during informal user tests (one of us watching the
other's flatmate try the page) that this was disorienting: people scrolled
straight to the shelf and saw items with no context.

We added a small state machine in [`js/lock.js`](docs/js/lock.js):

```
hero ─── pick a flag ──▶ choice ─── click a country ──▶ open
```

Each stage maps to a class on `<body>`, and the CSS hides every section past
that stage with `display: none`. It's a brutal but very effective way to force
narrative order. The user can still jump around via the nav bar once unlocked,
but the first time through, the story plays in the order we wrote.

### 4.3 · The persistent timeline

Our biggest mid-stream redesign came around week 6. We had a separate slider
on each page (map, production, shelf), and they were drifting out of sync. The
fix was to lift the slider out of every page and put it in a **floating
timebar fixed to the bottom of the viewport** ([`js/timebar.js`](docs/js/timebar.js)),
visible everywhere except the hero. Now there is **one** slider, one date,
one source of truth.

This also let us mount a news ticker into the same bar — the headline of the
event closest to the current date — which became the entry point for the
newspaper clipping (§4.5).

### 4.4 · The country drill-down

The original sketch had no concept of "click a country." During development we
realised the map was the most visually striking page but also the least
*interactive* once you had played the slider once. Adding a drill-down panel
([`js/drilldown.js`](docs/js/drilldown.js)) with a per-country mini line chart
vs. the European average, top-3 production sources and a "vs pre-shock"
delta solved that — and naturally enforced the rule that *the rest of the page
should follow the country you picked*.

This last point caused us to refactor the production chart and shelf to listen
for `selectedCountry` rather than have independent dropdowns. The dropdowns
are still there, but they now act as fine-grained overrides on top of the
map's selection.

### 4.5 · Newspaper clippings

The single-line news ticker felt anaemic — we wanted the moment when "Russia
invades Ukraine" hits the slider to *feel* like a moment. Several iterations
later, we landed on a small **tilted newspaper clipping** that pins to the
bottom-left of the viewport while the user is on the map page. It has a
masthead with the source, a serif headline, a drop-cap paragraph, an "impact
on the energy mix" pull-out box, and a "Read the full story" link. We
deliberately keep it small enough not to obscure the map.

We went through three versions of this before settling on the current one:

1. A centre-screen modal with a blurred backdrop. **Rejected:** blocked the map
   we were trying to read.
2. A top-left pinned card that followed scroll across all sections.
   **Rejected:** confusing to see Aug 2022 news while looking at a 2026 shelf.
3. The current version: bottom-left, **only while the map section is in view**
   (tracked with `IntersectionObserver`), still reachable elsewhere via the
   ticker pill.

### 4.6 · "Vs pre-shock" had a subtle bug

Christopher caught this one. The drill-down panel originally compared the
country's price at the slider date to a **single** anchor month (Jan 2024 for
Iran, Jun 2021 for Ukraine). At the shock month for Iran, France read **-28%
vs pre-shock**, which is mathematically right but semantically nonsense — the
"before" month was a particularly cold January, and the "after" month was a
sunny April with abundant solar. Seasonality dominated the comparison.

We replaced the single anchor with the **12-month rolling mean ending just
before the shock**, which smooths out the seasonal swing. The metric now reads
honestly: Iran's shock had marginal impact on European electricity (mostly
negative, because Europe was structurally cheaper post-2022 buffer-building),
while Ukraine's shock pushed every country into triple-digit positive deltas.
That was a small statistical change with a big narrative payoff.

### 4.7 · The conflict receipt

The shop shelf was already in the sketch, but we wanted a stronger closer than
"here are some grocery prices that went up." We added a **printed receipt**
page: the user clicks items on the shelf to drop them in a basket, and the
receipt prints out three subtotals — *before*, *at the peak*, and *at the
slider date* — with the war's added cost spelled out at the bottom. The
visual is intentionally a real-world receipt: cream paper, serrated edges,
monospaced font. People understand a receipt.

### 4.8 · Things we added late

In the final week we layered on three extras that we didn't promise in
Milestone 2 but felt essential:

- **Animated bar race** of the top-10 most expensive grids each month
  ([`js/barrace.js`](docs/js/barrace.js)). Reorders live as the slider moves.
- **Conflict-comparison split-screen** ([`js/compare.js`](docs/js/compare.js))
  aligning both conflicts at "month 0 = shock" so you can see the Ukraine peak
  (€405) towering over the Iran peak (€133).
- A **closing conclusion** section that puts our findings into plain English —
  the contrast between Ukraine's structural shock and Iran's softer ripple,
  plus the Hormuz buffer-erosion that we see in the most recent months.

---

## 5 · Design decisions and dead ends

A few choices were deliberate and worth flagging:

**Dark theme.** Energy is moody. The dataset is dramatic. A dark theme made
the conflict palette swap (Ukrainian blue+yellow vs. Iranian green+red) more
striking and let the choropleth carry the colour weight without competing
with chrome. We use Inter for UI and Playfair Display for headlines to give
the project a "long-read" feel.

**Conflict-aware palette.** When the user picks a conflict, the whole
`--accent` and `--conflict-2` CSS variables swap. Headings, slider tint,
selected-country outline, ticker badge — everything follows. This was three
lines of CSS and probably the highest visual-impact-per-line ratio in the
project.

**No build step.** We deliberately kept the website as plain HTML/CSS/vanilla
JS plus D3 from a CDN. No webpack, no React, no TypeScript. Two reasons:
(1) the course is about visualisation, not bundlers; (2) anyone — including the
graders — should be able to clone the repo and open `index.html` with nothing
more than a static file server. That constraint forced us to keep our JS
small and modular: 14 files, ~2,000 lines total.

**Dead ends worth mentioning:**

- We spent two days trying to build a **Sankey diagram** of each country's
  energy sources flowing to consumption. It looked technically nice but the
  numbers were too unstable (the source classification has nine buckets with
  wildly different scales), and we cut it.
- We tried an **animated cross-border flow map** with moving dots. Without
  reliable hourly flow data we'd have been fabricating, so we dropped it.
- Our first conflict picker used the real country flags as PNG images. Image
  quality at scale was poor, so we redrew them in pure CSS — three coloured
  stripes for Ukraine, three stripes plus a coat-of-arms glyph for Iran. Crisp
  at any resolution, themeable.

**One thing we'd do differently.** We chose monthly resampling everywhere
because the production and HICP data are monthly. But the ENTSO-E day-ahead
prices are hourly, and on the map we could have offered a "zoom to weekly"
toggle for the Aug 2022 peak. We didn't, and as a result the dramatic
intra-week price swings of summer 2022 are flattened.

---

## 6 · The final site, page by page

| # | Section | What it does |
|---|---|---|
| 1 | Hero | Animated particle backdrop, big serif title, "scroll" hint. Sets tone. |
| 2 | Choice | Two clickable flag cards. Locks scrolling until the user picks. |
| 3 | Map | Choropleth of monthly day-ahead prices, time slider, country drill-down on click, newspaper clipping for the active event. Bar race below it. |
| 4 | Production mix | Stacked area of MWh by source, absolute / share toggle, side-note explaining the seasonal cycle. Slider position marked. |
| 5 | Shelf | Pantry of 9 everyday item categories, hover for sparkline, click to add to basket. |
| 6 | Receipt | Printer-style receipt with before / peak / slider-date subtotals and the war's added cost. |
| 7 | Compare | Both conflicts aligned at month-0 = shock, peaks annotated, side-by-side. |
| 8 | Conclusion | Three cards (Ukraine, Iran, Hormuz) + closing paragraph. |

Tech stack: HTML5, CSS3, vanilla JavaScript (ES2020), D3.js v7,
topojson-client, Python 3 + pandas + entsoe-py for offline data preparation.

---

## 7 · What we learnt

- **Data first, visuals last.** Every clever visualisation we tried that
  didn't start from a careful look at the underlying numbers ended up
  misleading. The pre-shock baseline bug was the cleanest example.
- **Lifting state into a tiny reactive store** was the single decision that
  made the rest of the project possible. We almost didn't bother.
- **Force narrative order on first viewing.** Letting people free-scroll a
  scrollytelling piece destroys the story you spent weeks building. The
  scroll-lock state machine looked draconian on paper; it tested very well.
- **Care about the small things.** The newspaper clipping that animates in,
  the printer-style serration on the receipt, the bar race that reorders —
  none of these are load-bearing data viz, but they are what people remember.

---

## 8 · Peer assessment

The project was a genuine pair effort, with both of us contributing roughly
equally across data, code and design. We pair-programmed several of the
trickier features (the scroll-lock state machine, the price baseline fix) and
otherwise divided the work pragmatically as it came up.

| Area | Christopher Soriano | Timothé H. R. Dard |
|---|---|---|
| Problem framing & dataset scouting (M1) | ✓ co-lead | ✓ co-lead |
| ENTSO-E scraping & price pipeline | **primary** | review + 2026 update script |
| ElectricityMaps production pipeline | review | **primary** |
| Eurostat HICP item-price pipeline | **primary** | review |
| Website skeleton (M2) | review | **primary** |
| Reactive store + scroll-lock state machine | **co-author** | **co-author** |
| Map + choropleth + time slider | review | **primary** |
| Country drill-down panel | **primary** | review |
| Production stacked-area chart + seasonality note | **primary** | review |
| Shelf + basket + receipt | review | **primary** |
| Newspaper clipping + news ticker | review | **primary** |
| Top-10 bar race | **primary** | review |
| Conflict-comparison split-screen | **primary** | review |
| Conclusion section + copy | **co-author** | **co-author** |
| Visual design (palette, typography, dark theme) | review | **primary** |
| Process book (this document) | **co-author** | **co-author** |
| Screencast | **co-author** | **co-author** |

**Self-assessment.** We would estimate the work split at roughly 50/50.
Christopher leaned slightly more on the data/analytics side and the secondary
visualisations (bar race, comparison); Timothé leaned slightly more on the
core narrative pages (map, shelf, receipt) and the visual design. Neither of
us could have shipped the project alone in the time available.

---

*Built in May 2026 by Christopher Soriano and Timothé Henri Robert Dard.
Sources: ENTSO-E Transparency Platform, ElectricityMaps API, Eurostat HICP.
Stack: D3.js v7, vanilla JS, Python + pandas. Code:
[`github.com/com-480-data-visualization/Electro-Wizards`](https://github.com/com-480-data-visualization/Electro-Wizards).*

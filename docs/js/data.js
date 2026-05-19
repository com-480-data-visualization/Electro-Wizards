/* ========================================================================
   Shared application state + data loader.
   Exposes window.PC (Power & Conflict).
   ======================================================================== */
(function () {
  const PC = (window.PC = window.PC || {});

  // -- ISO mapping helpers --------------------------------------------------
  // Some of our datasets use ISO2 codes (FR, DE) that need to map to the
  // numeric ISO codes used by the natural-earth topojson countries-50m file.
  PC.iso2to3 = {
    AT: "AUT", BE: "BEL", BG: "BGR", CH: "CHE", CY: "CYP", CZ: "CZE", DE: "DEU",
    DK: "DNK", EE: "EST", ES: "ESP", FI: "FIN", FR: "FRA", GB: "GBR", GR: "GRC",
    HR: "HRV", HU: "HUN", IE: "IRL", IS: "ISL", IT: "ITA", LT: "LTU", LU: "LUX",
    LV: "LVA", ME: "MNE", MK: "MKD", MT: "MLT", NL: "NLD", NO: "NOR", PL: "POL",
    PT: "PRT", RO: "ROU", RS: "SRB", SE: "SWE", SI: "SVN", SK: "SVK", AL: "ALB",
    BA: "BIH", XK: "XKX", TR: "TUR", BY: "BLR", UA: "UKR", MD: "MDA", RU: "RUS",
    EL: "GRC",
  };
  PC.iso3to2 = Object.fromEntries(Object.entries(PC.iso2to3).map(([k, v]) => [v, k]));

  // Numeric ISO 3166-1 (used by world-atlas TopoJSON `id`) -> ISO2
  PC.isoNumTo2 = {
    "008": "AL", "020": "AD", "031": "AZ", "040": "AT", "051": "AM", "056": "BE",
    "070": "BA", "100": "BG", "112": "BY", "191": "HR", "196": "CY", "203": "CZ",
    "208": "DK", "233": "EE", "246": "FI", "250": "FR", "268": "GE", "276": "DE",
    "292": "GI", "300": "GR", "336": "VA", "348": "HU", "352": "IS", "364": "IR",
    "372": "IE", "380": "IT", "428": "LV", "438": "LI", "440": "LT", "442": "LU",
    "470": "MT", "498": "MD", "499": "ME", "492": "MC", "528": "NL", "578": "NO",
    "616": "PL", "620": "PT", "642": "RO", "643": "RU", "674": "SM", "688": "RS",
    "703": "SK", "705": "SI", "724": "ES", "752": "SE", "756": "CH", "792": "TR",
    "804": "UA", "807": "MK", "826": "GB", "983": "XK",
  };

  PC.countryNames = {
    AT: "Austria", BE: "Belgium", BG: "Bulgaria", CH: "Switzerland", CY: "Cyprus",
    CZ: "Czechia", DE: "Germany", DK: "Denmark", EE: "Estonia", ES: "Spain",
    FI: "Finland", FR: "France", GB: "United Kingdom", GR: "Greece", HR: "Croatia",
    HU: "Hungary", IE: "Ireland", IS: "Iceland", IT: "Italy", LT: "Lithuania",
    LU: "Luxembourg", LV: "Latvia", ME: "Montenegro", MK: "North Macedonia",
    MT: "Malta", NL: "Netherlands", NO: "Norway", PL: "Poland", PT: "Portugal",
    RO: "Romania", RS: "Serbia", SE: "Sweden", SI: "Slovenia", SK: "Slovakia",
    AL: "Albania", EL: "Greece", EA: "Euro area", EU: "European Union",
    TR: "Turkey", XK: "Kosovo",
  };

  // -- Reactive store -------------------------------------------------------
  const listeners = {};
  PC.state = {
    conflict: null,        // 'ukraine' | 'iran' | null
    monthIndex: 0,         // index into prices.dates
    basket: [],            // array of item names
    shelfCountry: "FR",
    prodCountry: "FR",
    prodMode: "absolute",  // or 'share'
    selectedCountry: null, // ISO2 of the country currently drilled into on the map
    stage: "hero",         // lock state machine (see lock.js)
  };
  PC.set = function (patch) {
    const old = { ...PC.state };
    Object.assign(PC.state, patch);
    Object.keys(patch).forEach((k) => {
      (listeners[k] || []).forEach((fn) => fn(PC.state[k], old[k]));
    });
    (listeners["*"] || []).forEach((fn) => fn(PC.state, old));
  };
  PC.on = function (key, fn) {
    (listeners[key] = listeners[key] || []).push(fn);
  };

  // -- Data load ------------------------------------------------------------
  PC.data = {};
  PC.ready = Promise.all([
    fetch("data/prices_monthly.json").then((r) => r.json()),
    fetch("data/production_monthly.json").then((r) => r.json()),
    fetch("data/items_monthly.json").then((r) => r.json()),
    fetch("data/timeline.json").then((r) => r.json()),
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json").then((r) => r.json()),
  ]).then(([prices, prod, items, timeline, world]) => {
    PC.data.prices = prices;
    PC.data.production = prod;
    PC.data.items = items;
    PC.data.timeline = timeline;
    PC.data.world = world;
    return PC.data;
  });

  // -- Conflict-aware helpers ----------------------------------------------
  // Anchor month for "before the shock" and the chosen conflict's peak month.
  PC.conflictWindow = function () {
    if (PC.state.conflict === "ukraine") {
      return { before: "2021-06", shock: "2022-02", peak: "2022-08", focusYear: 2022 };
    }
    if (PC.state.conflict === "iran") {
      return { before: "2024-01", shock: "2024-04", peak: "2025-09", focusYear: 2025 };
    }
    // Fallback for the no-choice case
    return { before: "2021-06", shock: "2022-02", peak: "2022-08", focusYear: 2022 };
  };

  PC.findEvent = function (date) {
    const tl = PC.data.timeline?.[PC.state.conflict];
    if (!tl) return null;
    let active = null;
    for (const ev of tl.events) {
      if (ev.date <= date) active = ev; else break;
    }
    return active;
  };

  // Mean price over the 12 months ending one month BEFORE the shock month.
  // This smooths out seasonality and gives a stable "pre-shock" reference.
  PC.preShockBaseline = function (iso2) {
    const arr = PC.data.prices.values[iso2];
    if (!arr) return null;
    const dates = PC.data.prices.dates;
    const cw = PC.conflictWindow();
    const shockIdx = dates.indexOf(cw.shock);
    if (shockIdx < 0) return null;
    const end = shockIdx; // exclusive
    const start = Math.max(0, end - 12);
    let sum = 0, n = 0;
    for (let i = start; i < end; i++) {
      if (arr[i] != null) { sum += arr[i]; n++; }
    }
    return n ? sum / n : null;
  };

  // Item -> emoji icon
  PC.itemEmoji = {
    "Bread": "🍞",
    "Meat": "🥩",
    "Milk, cheese and eggs": "🧀",
    "Oils and fats": "🫒",
    "Fruit": "🍎",
    "Vegetables": "🥕",
    "Sugar & confectionery": "🍬",
    "Coffee, tea and cocoa": "☕",
    "Electricity": "💡",
  };

  // Currency / number formatting
  PC.fmt = {
    eur: (v) => (v == null ? "—" : "€" + v.toFixed(2)),
    eurMWh: (v) => (v == null ? "—" : "€" + v.toFixed(0) + "/MWh"),
    delta: (a, b) => {
      if (a == null || b == null || a === 0) return "—";
      const pct = ((b - a) / a) * 100;
      const sign = pct >= 0 ? "+" : "";
      return `${sign}${pct.toFixed(0)}%`;
    },
  };
})();

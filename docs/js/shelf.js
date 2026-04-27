/* Visual "pantry shelf" of everyday items, hover -> tooltip with prices,
   click -> add/remove from basket. */
(function () {
  let stage, tooltipEl;

  // We organise items into 3 shelves to mimic the sketch.
  const SHELVES = [
    ["Bread", "Milk, cheese and eggs", "Meat", "Oils and fats"],
    ["Fruit", "Vegetables", "Sugar & confectionery", "Coffee, tea and cocoa"],
    ["Electricity"],
  ];

  function init() {
    stage = document.getElementById("shelf-stage");
    tooltipEl = document.getElementById("shelf-tooltip");

    // Country dropdown
    const sel = document.getElementById("shelf-country");
    const itemsData = PC.data.items;
    const countries = itemsData.countries.filter((c) => !["EA", "EU"].includes(c));
    sel.innerHTML = countries
      .map((c) => `<option value="${c}">${PC.countryNames[c] || c}</option>`)
      .join("");
    sel.value = PC.state.shelfCountry;
    sel.addEventListener("change", (e) => PC.set({ shelfCountry: e.target.value }));

    PC.on("shelfCountry", () => render());
    PC.on("conflict", () => render());
    PC.on("basket", () => render());

    render();
  }

  function priceAt(item, country, isoMonth) {
    const it = PC.data.items.data[item];
    if (!it) return null;
    const idx = it.dates.indexOf(isoMonth);
    if (idx < 0) return null;
    const arr = it.countries[country];
    if (!arr) return null;
    return arr[idx];
  }
  function nearestPrice(item, country, isoMonth) {
    const it = PC.data.items.data[item];
    if (!it) return null;
    const arr = it.countries[country];
    if (!arr) return null;
    let i = it.dates.indexOf(isoMonth);
    if (i < 0) {
      // find first date >= isoMonth
      i = it.dates.findIndex((d) => d >= isoMonth);
      if (i < 0) i = it.dates.length - 1;
    }
    // walk backward / forward if missing
    if (arr[i] != null) return arr[i];
    for (let off = 1; off < 12; off++) {
      if (i - off >= 0 && arr[i - off] != null) return arr[i - off];
      if (i + off < arr.length && arr[i + off] != null) return arr[i + off];
    }
    return null;
  }

  function summaryFor(item) {
    const country = PC.state.shelfCountry;
    const cw = PC.conflictWindow();
    const itData = PC.data.items.data[item];
    if (!itData) return null;
    const arr = itData.countries[country] || [];
    const dates = itData.dates;

    const before = nearestPrice(item, country, cw.before);
    // peak: max value on/after shock month
    const shockIdx = Math.max(0, dates.findIndex((d) => d >= cw.shock));
    let peak = null, peakDate = null;
    for (let i = shockIdx; i < dates.length; i++) {
      if (arr[i] != null && (peak == null || arr[i] > peak)) {
        peak = arr[i]; peakDate = dates[i];
      }
    }
    const latest = arr[arr.length - 1];

    return { before, peak, peakDate, latest, dates, arr };
  }

  function render() {
    stage.innerHTML = "";
    SHELVES.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "shelf-row";
      row.forEach((item) => {
        const sum = summaryFor(item);
        const before = sum?.before, latest = sum?.latest;
        const delta = (before && latest) ? ((latest - before) / before) * 100 : null;
        const inBasket = PC.state.basket.includes(item);

        const el = document.createElement("div");
        el.className = "shelf-item" + (inBasket ? " in-basket" : "");
        el.innerHTML = `
          <span class="basket-tag">✓</span>
          <span class="item-emoji">${PC.itemEmoji[item] || "📦"}</span>
          <div class="item-name">${shortName(item)}</div>
          <div class="item-delta ${delta != null && delta < 0 ? "down" : ""}">
            ${delta == null ? "—" : (delta >= 0 ? "+" : "") + delta.toFixed(0) + "%"}
          </div>
        `;
        el.addEventListener("mouseenter", (ev) => showTip(ev, item));
        el.addEventListener("mousemove", positionTip);
        el.addEventListener("mouseleave", hideTip);
        el.addEventListener("click", () => toggleBasket(item));
        rowEl.appendChild(el);
      });
      stage.appendChild(rowEl);
    });
  }

  function shortName(item) {
    if (item === "Milk, cheese and eggs") return "Dairy";
    if (item === "Coffee, tea and cocoa") return "Coffee";
    if (item === "Sugar & confectionery") return "Sugar";
    if (item === "Oils and fats") return "Oils";
    return item;
  }

  function showTip(ev, item) {
    const sum = summaryFor(item);
    if (!sum) return;

    tooltipEl.querySelector(".tt-emoji").textContent = PC.itemEmoji[item] || "📦";
    tooltipEl.querySelector(".tt-name").textContent = item;

    tooltipEl.querySelector(".tt-before").textContent = PC.fmt.eur(sum.before);
    tooltipEl.querySelector(".tt-peak").textContent = sum.peak != null
      ? PC.fmt.eur(sum.peak) + " (" + (sum.peakDate || "") + ")"
      : "—";
    tooltipEl.querySelector(".tt-latest").textContent = PC.fmt.eur(sum.latest);

    drawSpark(tooltipEl.querySelector(".tt-spark"), sum.dates, sum.arr);

    tooltipEl.classList.add("show");
    positionTip(ev);
  }
  function positionTip(ev) {
    const r = tooltipEl.getBoundingClientRect();
    let x = ev.clientX + 14;
    let y = ev.clientY + 14;
    if (x + r.width > window.innerWidth) x = ev.clientX - r.width - 14;
    if (y + r.height > window.innerHeight) y = ev.clientY - r.height - 14;
    tooltipEl.style.left = x + "px";
    tooltipEl.style.top = y + "px";
  }
  function hideTip() {
    tooltipEl.classList.remove("show");
  }

  function drawSpark(host, dates, values) {
    host.innerHTML = "";
    const W = host.clientWidth || 210;
    const H = 36;
    const valid = values.map((v, i) => [i, v]).filter((d) => d[1] != null);
    if (valid.length < 2) return;

    const x = d3.scaleLinear().domain([0, values.length - 1]).range([0, W]);
    const yExt = d3.extent(valid, (d) => d[1]);
    const y = d3.scaleLinear().domain(yExt).range([H - 2, 2]);

    const svg = d3.select(host).append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .attr("height", H);

    const line = d3.line()
      .defined((d) => d[1] != null)
      .x((d) => x(d[0])).y((d) => y(d[1]))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(values.map((v, i) => [i, v]))
      .attr("fill", "none")
      .attr("stroke", "var(--accent)")
      .attr("stroke-width", 1.6)
      .attr("d", line);

    // shock marker
    const cw = PC.conflictWindow();
    const sIdx = dates.indexOf(cw.shock);
    if (sIdx >= 0) {
      svg.append("line")
        .attr("x1", x(sIdx)).attr("x2", x(sIdx))
        .attr("y1", 0).attr("y2", H)
        .attr("stroke", "rgba(255,255,255,0.4)")
        .attr("stroke-dasharray", "2 2");
    }
  }

  function toggleBasket(item) {
    const list = [...PC.state.basket];
    const i = list.indexOf(item);
    if (i >= 0) list.splice(i, 1); else list.push(item);
    PC.set({ basket: list });
  }

  document.addEventListener("DOMContentLoaded", () => {
    PC.ready.then(init);
  });
})();

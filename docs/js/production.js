// Stacked area chart of monthly production mix per country.
(function () {
  let chartEl, container;
  // Source -> color (sorted to match a natural mix order)
  const SOURCE_ORDER = [
    "coal", "oil", "gas", "nuclear", "biomass",
    "hydro", "wind", "solar", "geothermal",
  ];
  const COLORS = {
    coal: "#3a3a3a",
    oil: "#665245",
    gas: "#d97706",
    nuclear: "#a855f7",
    biomass: "#84cc16",
    hydro: "#3b82f6",
    wind: "#22d3ee",
    solar: "#facc15",
    geothermal: "#dc2626",
  };
  let mutedSources = new Set();

  function init() {
    chartEl = document.getElementById("production-chart");
    container = chartEl;

    // Country dropdown
    const sel = document.getElementById("prod-country");
    const countries = Object.keys(PC.data.production.countries).sort((a, b) =>
      (PC.countryNames[a] || a).localeCompare(PC.countryNames[b] || b)
    );
    sel.innerHTML = countries
      .map((c) => `<option value="${c}">${PC.countryNames[c] || c}</option>`)
      .join("");

    sel.value = PC.state.prodCountry;
    sel.addEventListener("change", (e) => {
      // Manual dropdown override also bumps selectedCountry so map + shelf sync.
      PC.set({ prodCountry: e.target.value, selectedCountry: e.target.value });
    });

    // Mode buttons
    const modeBtns = document.querySelectorAll(".prod-mode button");
    modeBtns.forEach((b) => {
      b.addEventListener("click", () => {
        modeBtns.forEach((x) => x.classList.toggle("active", x === b));
        PC.set({ prodMode: b.dataset.mode });
      });
    });

    // When the map selection changes, snap the dropdown to it.
    PC.on("selectedCountry", (iso2) => {
      if (!iso2) return;
      if (PC.data.production.countries[iso2]) {
        sel.value = iso2;
        PC.set({ prodCountry: iso2 });
      }
    });

    PC.on("prodCountry", () => render());
    PC.on("prodMode", () => render());
    PC.on("conflict", () => render());
    PC.on("monthIndex", () => render());
    PC.on("stage", () => render());

    // Re-render when the section first becomes visible (so width is non-zero
    // after the stage-gate hides it initially).
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) render(); });
    }, { threshold: 0.05 });
    io.observe(document.getElementById("production"));

    window.addEventListener("resize", render);

    render();
  }

  function render() {
    // Bail out if the container isn't visible yet (avoids -40 width SVGs).
    if (!container || container.clientWidth < 80) return;
    const country = PC.state.prodCountry;
    const data = PC.data.production;
    const dates = data.dates;
    const sourcesAvailable = SOURCE_ORDER.filter((s) => data.countries[country]?.[s]);

    // Build records [{date, source, value}, ...]
    const records = dates.map((d, i) => {
      const row = { date: d };
      sourcesAvailable.forEach((s) => {
        const arr = data.countries[country][s] || [];
        let v = arr[i];
        if (v == null || v < 0) v = 0;
        row[s] = mutedSources.has(s) ? 0 : v;
      });
      return row;
    });

    if (PC.state.prodMode === "share") {
      records.forEach((r) => {
        let total = 0;
        sourcesAvailable.forEach((s) => total += r[s]);
        if (total > 0) sourcesAvailable.forEach((s) => r[s] = r[s] / total);
        else sourcesAvailable.forEach((s) => r[s] = 0);
      });
    }

    const stack = d3.stack().keys(sourcesAvailable).order(d3.stackOrderNone);
    const series = stack(records);

    // SVG
    const W = container.clientWidth - 40;
    const H = 380;
    const margin = { top: 14, right: 16, bottom: 30, left: 56 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    let svg = d3.select(container).select("svg");
    if (svg.empty()) {
      svg = d3.select(container).append("svg")
        .attr("viewBox", `0 0 ${W} ${H}`);
      svg.append("g").attr("class", "chart-g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    } else {
      svg.attr("viewBox", `0 0 ${W} ${H}`);
    }
    const g = svg.select(".chart-g");

    const x = d3.scalePoint().domain(dates).range([0, innerW]);
    const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

    // X axis (ticks every Jan)
    const xTicks = dates.filter((d) => d.endsWith("-01"));
    let gx = g.select(".axis-x");
    if (gx.empty()) gx = g.append("g").attr("class", "axis-x").attr("transform", `translate(0,${innerH})`);
    gx.attr("transform", `translate(0,${innerH})`).call(
      d3.axisBottom(x).tickValues(xTicks).tickFormat((d) => d.split("-")[0]).tickSizeOuter(0)
    );
    gx.selectAll("text").attr("fill", "#b6bccb").attr("font-size", "11");
    gx.selectAll("path,line").attr("stroke", "rgba(255,255,255,0.15)");

    // Y axis
    let gy = g.select(".axis-y");
    if (gy.empty()) gy = g.append("g").attr("class", "axis-y");
    const fmtY = PC.state.prodMode === "share"
      ? d3.format(".0%")
      : (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + " M" : v >= 1e3 ? (v / 1e3).toFixed(0) + " k" : v;
    gy.call(d3.axisLeft(y).ticks(5).tickFormat(fmtY).tickSize(-innerW));
    gy.selectAll("text").attr("fill", "#b6bccb").attr("font-size", "11");
    gy.selectAll("path").attr("stroke", "rgba(255,255,255,0.15)");
    gy.selectAll("line").attr("stroke", "rgba(255,255,255,0.05)");

    // Areas
    const area = d3.area()
      .x((d) => x(d.data.date))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveMonotoneX);

    const layers = g.selectAll(".layer").data(series, (d) => d.key);
    layers.exit().remove();

    const layerEnter = layers.enter().append("path")
      .attr("class", "layer")
      .attr("fill-opacity", 0.92)
      .attr("stroke", "rgba(0,0,0,0.2)")
      .attr("stroke-width", 0.5);

    layerEnter.merge(layers)
      .attr("fill", (d) => COLORS[d.key] || "#888")
      .transition().duration(400)
      .attr("d", area);

    // Conflict shock marker
    const cw = PC.conflictWindow();
    const shockX = x(cw.shock);
    let marker = g.select(".shock-marker");
    if (marker.empty()) {
      marker = g.append("g").attr("class", "shock-marker");
      marker.append("line").attr("stroke", "#fff").attr("stroke-dasharray", "4 4").attr("stroke-opacity", 0.6);
      marker.append("text").attr("fill", "#fff").attr("font-size", "11").attr("font-weight", 600);
    }
    if (shockX != null) {
      marker.style("display", null);
      marker.select("line").attr("x1", shockX).attr("x2", shockX).attr("y1", 0).attr("y2", innerH);
      marker.select("text").attr("x", shockX + 6).attr("y", 14).text("shock");
    } else {
      marker.style("display", "none");
    }

    // Slider marker tracks the timebar.
    const sliderDate = PC.data.prices.dates[PC.state.monthIndex];
    const sliderX = sliderDate ? x(sliderDate) : null;
    let sliderMarker = g.select(".slider-marker");
    if (sliderMarker.empty()) {
      sliderMarker = g.append("g").attr("class", "slider-marker");
      sliderMarker.append("line")
        .attr("stroke", "var(--conflict-2)")
        .attr("stroke-width", 2);
      sliderMarker.append("circle")
        .attr("r", 4)
        .attr("fill", "var(--conflict-2)");
    }
    if (sliderX != null) {
      sliderMarker.style("display", null);
      sliderMarker.select("line").attr("x1", sliderX).attr("x2", sliderX).attr("y1", 0).attr("y2", innerH);
      sliderMarker.select("circle").attr("cx", sliderX).attr("cy", innerH);
    } else {
      sliderMarker.style("display", "none");
    }

    // Annotation pills disabled; helper kept for now.
    g.selectAll(".annotation").remove();

    // Legend
    let legend = container.querySelector(".prod-legend");
    if (!legend) {
      legend = document.createElement("div");
      legend.className = "prod-legend";
      container.appendChild(legend);
    }
    legend.innerHTML = SOURCE_ORDER
      .filter((s) => sourcesAvailable.includes(s))
      .map((s) => `<span class="${mutedSources.has(s) ? 'muted' : ''}" data-src="${s}">
        <i style="background:${COLORS[s]}"></i>${s}
      </span>`).join("");
    legend.querySelectorAll("span").forEach((sp) => {
      sp.addEventListener("click", () => {
        const k = sp.dataset.src;
        if (mutedSources.has(k)) mutedSources.delete(k); else mutedSources.add(k);
        render();
      });
    });

    // Takeaway
    document.getElementById("prod-takeaway-text").textContent = takeawayFor(country, data, cw);
  }

  // Pick the 2 sources whose share changed most between the 12 months before
  // the shock and the 6 months after, and draw labelled pills on the chart.
  function drawAnnotations(g, x, y, series, dates, sources, country, innerW, innerH) {
    const cw = PC.conflictWindow();
    const shockIdx = dates.indexOf(cw.shock);
    if (shockIdx < 0) {
      g.selectAll(".annotation").remove();
      return;
    }

    const data = PC.data.production.countries[country] || {};
    const totalAt = (i) => sources.reduce((s, src) => s + (data[src]?.[i] ?? 0), 0);
    const avgShare = (src, from, to) => {
      let sum = 0, n = 0;
      for (let i = from; i < to; i++) {
        const t = totalAt(i);
        if (t > 0 && data[src]?.[i] != null) { sum += (data[src][i] / t); n++; }
      }
      return n ? sum / n : null;
    };

    const beforeFrom = Math.max(0, shockIdx - 12);
    const afterTo = Math.min(dates.length, shockIdx + 6);

    const changes = sources.map((src) => {
      const a = avgShare(src, beforeFrom, shockIdx);
      const b = avgShare(src, shockIdx, afterTo);
      if (a == null || b == null) return null;
      return { src, before: a, after: b, delta: b - a };
    }).filter(Boolean).filter((d) => Math.abs(d.delta) >= 0.05);

    changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const picks = changes.slice(0, 2);

    // Anchor x = mid-point of the "after" window
    const anchorIdx = Math.floor((shockIdx + afterTo) / 2);
    const anchorDate = dates[anchorIdx];
    const anchorX = x(anchorDate);

    // For each picked source, find its y-band centre at the anchor month
    // so the connector points at the right ribbon.
    const layerForSrc = (s) => series.find((ss) => ss.key === s);

    const annotation = g.selectAll(".annotation").data(picks, (d) => d.src);
    annotation.exit().remove();
    const enter = annotation.enter().append("g").attr("class", "annotation");

    enter.append("line").attr("class", "anno-line")
      .attr("stroke", "rgba(255,255,255,0.6)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2 2");
    enter.append("circle").attr("class", "anno-dot")
      .attr("r", 3).attr("fill", "var(--conflict-2)");
    enter.append("g").attr("class", "anno-pill-g");

    const all = enter.merge(annotation);
    all.each(function (d, i) {
      const layer = layerForSrc(d.src);
      if (!layer) return;
      const stack = layer[anchorIdx];
      if (!stack) return;
      const bandY = (y(stack[0]) + y(stack[1])) / 2;

      // Pill above the chart, alternating sides if both are close
      const isLeft = i === 0;
      const pillX = isLeft ? Math.max(80, anchorX - 100) : Math.min(innerW - 80, anchorX + 100);
      const pillY = 14 + i * 20;

      d3.select(this).select(".anno-line")
        .attr("x1", anchorX).attr("y1", bandY)
        .attr("x2", pillX).attr("y2", pillY + 12);
      d3.select(this).select(".anno-dot")
        .attr("cx", anchorX).attr("cy", bandY);

      const sign = d.delta >= 0 ? "▲" : "▼";
      const pp = Math.abs(d.delta * 100).toFixed(0);
      const text = `${sign} ${d.src} ${d.delta >= 0 ? "+" : "−"}${pp} pp`;

      // Recreate the pill content each render (sizes/positions change with width)
      const pillG = d3.select(this).select(".anno-pill-g")
        .attr("transform", `translate(${pillX},${pillY})`);
      pillG.selectAll("*").remove();
      const textEl = pillG.append("text")
        .attr("x", 0).attr("y", 0)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#fff")
        .attr("font-size", "11")
        .attr("font-weight", "600")
        .text(text);
      const bbox = textEl.node().getBBox();
      const padX = 10, padY = 5;
      pillG.insert("rect", "text")
        .attr("x", bbox.x - padX)
        .attr("y", bbox.y - padY)
        .attr("width", bbox.width + 2 * padX)
        .attr("height", bbox.height + 2 * padY)
        .attr("rx", 10)
        .attr("fill", d.delta >= 0 ? "rgba(255, 87, 87, 0.85)" : "rgba(46, 196, 182, 0.85)")
        .attr("stroke", "rgba(255,255,255,0.25)");
    });
  }

  function takeawayFor(country, data, cw) {
    const dates = data.dates;
    const idxBefore = dates.indexOf(cw.before);
    const idxPeak = dates.indexOf(cw.peak);
    if (idxBefore < 0 || idxPeak < 0) return "Pick a country to see how its mix shifted.";

    const sources = data.countries[country] || {};
    const totalAt = (i) => SOURCE_ORDER.reduce((sum, s) => sum + (sources[s]?.[i] ?? 0), 0);

    function shareOf(s, i) {
      const t = totalAt(i);
      return t ? (sources[s]?.[i] ?? 0) / t : 0;
    }
    const dGas = shareOf("gas", idxPeak) - shareOf("gas", idxBefore);
    const dCoal = shareOf("coal", idxPeak) - shareOf("coal", idxBefore);
    const dRenew = (shareOf("wind", idxPeak) + shareOf("solar", idxPeak) + shareOf("hydro", idxPeak)) -
                   (shareOf("wind", idxBefore) + shareOf("solar", idxBefore) + shareOf("hydro", idxBefore));

    const name = PC.countryNames[country] || country;
    const intro = `Between ${cw.before} and ${cw.peak}, ${name}`;
    const parts = [];
    if (Math.abs(dGas) > 0.02) parts.push(`shifted ${dGas > 0 ? "more" : "less"} of its mix toward gas (${(dGas * 100).toFixed(1)} pp)`);
    if (Math.abs(dCoal) > 0.02) parts.push(`${dCoal > 0 ? "leaned harder on coal" : "cut coal"} (${(dCoal * 100).toFixed(1)} pp)`);
    if (Math.abs(dRenew) > 0.02) parts.push(`${dRenew > 0 ? "grew" : "shrank"} renewables share (${(dRenew * 100).toFixed(1)} pp)`);
    if (!parts.length) parts.push("kept its energy mix roughly stable");

    return `${intro} ${parts.join(" · ")}.`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    PC.ready.then(init);
  });
})();

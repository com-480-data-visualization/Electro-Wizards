// Country drill-down side panel: mini price chart vs EU avg + top sources.
(function () {
  // Flag emojis indexed by ISO2 (used as a quick country chip).
  const FLAG = (iso2) => {
    if (!iso2 || iso2.length !== 2) return "🏳️";
    const A = 0x1F1E6, off = "A".charCodeAt(0);
    return String.fromCodePoint(A + iso2.charCodeAt(0) - off) +
           String.fromCodePoint(A + iso2.charCodeAt(1) - off);
  };

  function init() {
    PC.on("selectedCountry", (iso2) => {
      if (iso2) showDrill(iso2);
      else hideDrill();
    });
    PC.on("monthIndex", () => {
      if (PC.state.selectedCountry) showDrill(PC.state.selectedCountry);
    });

    const close = document.getElementById("drill-close");
    if (close) close.addEventListener("click", () => {
      PC.set({ selectedCountry: null });
    });

    // CTA scrolls down to production
    const cta = document.getElementById("drill-cta");
    if (cta) cta.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("production").scrollIntoView({ behavior: "smooth" });
    });
  }

  function showDrill(iso2) {
    document.getElementById("side-default").hidden = true;
    document.getElementById("side-drill").hidden = false;

    document.getElementById("drill-flag").textContent = FLAG(iso2);
    document.getElementById("drill-name").textContent =
      PC.countryNames[iso2] || iso2;
    document.getElementById("drill-sub").textContent =
      "Country focus · click another to compare";

    // Stats. "Before" baseline is a 12-month avg ending just before the
    // shock month, so seasonality doesn't dominate the comparison.
    const idx = PC.state.monthIndex;
    const arr = PC.data.prices.values[iso2] || [];
    const price = arr[idx];
    const baseline = PC.preShockBaseline(iso2);
    const deltaPct = baseline && price != null ? ((price - baseline) / baseline) * 100 : null;

    document.getElementById("drill-stats").innerHTML = `
      <div class="drill-stat">
        <div class="drill-stat-label">At slider date</div>
        <div class="drill-stat-value">${PC.fmt.eurMWh(price)}</div>
      </div>
      <div class="drill-stat">
        <div class="drill-stat-label">vs pre-shock avg</div>
        <div class="drill-stat-value" style="color:${deltaPct == null ? 'var(--ink)' : deltaPct >= 0 ? '#ff7676' : '#2ec4b6'}">
          ${deltaPct == null ? "—" : (deltaPct >= 0 ? "+" : "") + deltaPct.toFixed(0) + "%"}
        </div>
      </div>
    `;

    renderChart(iso2);
    renderTopSources(iso2);
  }

  function hideDrill() {
    document.getElementById("side-default").hidden = false;
    document.getElementById("side-drill").hidden = true;
  }

  function renderChart(iso2) {
    const host = document.getElementById("drill-chart");
    host.innerHTML = "";
    const dates = PC.data.prices.dates;
    const arr = PC.data.prices.values[iso2] || [];

    // Europe average per month (computed across all reporting countries)
    const euAvg = dates.map((_, i) => {
      const vals = [];
      Object.values(PC.data.prices.values).forEach((a) => {
        if (a[i] != null) vals.push(a[i]);
      });
      return vals.length ? d3.mean(vals) : null;
    });

    const W = host.clientWidth || 260;
    const H = host.clientHeight || 110;
    const M = { top: 6, right: 10, bottom: 18, left: 32 };
    const innerW = W - M.left - M.right;
    const innerH = H - M.top - M.bottom;

    const svg = d3.select(host).append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`);

    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    const x = d3.scaleLinear().domain([0, dates.length - 1]).range([0, innerW]);
    const maxV = d3.max([...arr, ...euAvg].filter((v) => v != null)) || 1;
    const y = d3.scaleLinear().domain([0, maxV]).range([innerH, 0]);

    // EU avg line (lighter)
    const lineEu = d3.line()
      .defined((d) => d != null)
      .x((_, i) => x(i))
      .y((d) => y(d));
    g.append("path")
      .datum(euAvg)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.35)")
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "3 3")
      .attr("d", lineEu);

    // Country line
    const lineCty = d3.line()
      .defined((d) => d != null)
      .x((_, i) => x(i))
      .y((d) => y(d));
    g.append("path")
      .datum(arr)
      .attr("fill", "none")
      .attr("stroke", "var(--accent)")
      .attr("stroke-width", 1.8)
      .attr("d", lineCty);

    // Slider marker
    const idx = PC.state.monthIndex;
    g.append("line")
      .attr("x1", x(idx)).attr("x2", x(idx))
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "var(--conflict-2)")
      .attr("stroke-width", 1.2);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat((i) => (dates[i] || "").split("-")[0]).tickSize(0))
      .selectAll("text").attr("fill", "#7c8499").attr("font-size", 10);
    g.selectAll(".domain").attr("stroke", "rgba(255,255,255,0.15)");
    g.append("g")
      .call(d3.axisLeft(y).ticks(3).tickFormat((v) => "€" + v).tickSize(0))
      .selectAll("text").attr("fill", "#7c8499").attr("font-size", 10);

    // Legend
    g.append("text")
      .attr("x", 0).attr("y", 8)
      .attr("fill", "var(--accent)").attr("font-size", 10).attr("font-weight", 600)
      .text(PC.countryNames[iso2] || iso2);
    g.append("text")
      .attr("x", 60).attr("y", 8)
      .attr("fill", "rgba(255,255,255,0.5)").attr("font-size", 10)
      .text("EU avg");
  }

  function renderTopSources(iso2) {
    const host = document.getElementById("drill-sources");
    const data = PC.data.production.countries[iso2];
    if (!data) {
      host.innerHTML = "<em style='color:var(--ink-mute);'>No production data for this country.</em>";
      return;
    }
    // Compute share of mix at the latest available date
    const dates = PC.data.production.dates;
    let i = dates.length - 1;
    while (i >= 0) {
      const total = Object.values(data).reduce((s, arr) => s + (arr[i] ?? 0), 0);
      if (total > 0) break;
      i--;
    }
    if (i < 0) {
      host.innerHTML = "<em>No production data.</em>";
      return;
    }
    const total = Object.values(data).reduce((s, arr) => s + (arr[i] ?? 0), 0);
    const ranked = Object.entries(data)
      .map(([src, arr]) => [src, (arr[i] ?? 0) / total])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    host.innerHTML = `
      <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:6px;">
        Mix today · ${dates[i]}
      </div>
      ${ranked.map(([src, v]) =>
        `<div><strong>${src}</strong> · ${(v * 100).toFixed(0)}%</div>`
      ).join("")}
    `;
  }

  document.addEventListener("DOMContentLoaded", () => PC.ready.then(init));
})();

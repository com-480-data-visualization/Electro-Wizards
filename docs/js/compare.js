// Conflict comparison: EU avg price aligned at month 0 = shock for each crisis.
(function () {
  let host;

  function init() {
    host = document.getElementById("compare-chart");
    if (!host) return;
    window.addEventListener("resize", render);
    PC.on("stage", () => render());
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) render(); });
    }, { threshold: 0.05 });
    io.observe(host);
    render();
  }

  function render() {
    if (!host || host.clientWidth < 120) return;

    const dates = PC.data.prices.dates;
    const countries = PC.data.prices.countries;
    // EU monthly mean across all reporting countries
    const euAvg = dates.map((_, i) => {
      const vals = [];
      countries.forEach((c) => {
        const v = PC.data.prices.values[c]?.[i];
        if (v != null) vals.push(v);
      });
      return vals.length ? d3.mean(vals) : null;
    });

    const conflicts = [
      { id: "ukraine", label: "Russia–Ukraine (shock = Feb 2022)", shock: "2022-02", color: "#5b8def" },
      { id: "iran",    label: "Iran flare-up (shock = Apr 2024)",   shock: "2024-04", color: "#ff7676" },
    ];

    // Build series of (offset, price) where offset is months since shock.
    const WINDOW = 36;  // -6 .. +30 months
    const back = 6, forward = 30;
    const series = conflicts.map((c) => {
      const idx = dates.indexOf(c.shock);
      if (idx < 0) return { ...c, data: [] };
      const data = [];
      for (let off = -back; off <= forward; off++) {
        const i = idx + off;
        if (i < 0 || i >= dates.length) continue;
        data.push({ offset: off, value: euAvg[i], date: dates[i] });
      }
      return { ...c, data };
    });

    host.innerHTML = "";
    const W = host.clientWidth;
    const H = 380;
    const m = { top: 20, right: 24, bottom: 32, left: 56 };
    const innerW = W - m.left - m.right;
    const innerH = H - m.top - m.bottom;

    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    const x = d3.scaleLinear().domain([-back, forward]).range([0, innerW]);
    const yMax = d3.max(series.flatMap((s) => s.data.map((d) => d.value).filter((v) => v != null))) || 100;
    const y = d3.scaleLinear().domain([0, yMax * 1.05]).nice().range([innerH, 0]);

    // Axes
    g.append("g").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat((d) => d === 0 ? "shock" : (d > 0 ? `+${d}` : `${d}`)))
      .selectAll("text").attr("fill", "#b6bccb").attr("font-size", 11);
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat((v) => "€" + v).tickSize(-innerW))
      .selectAll("text").attr("fill", "#b6bccb").attr("font-size", 11);
    g.selectAll(".domain").attr("stroke", "rgba(255,255,255,0.18)");
    g.selectAll(".tick line").attr("stroke", "rgba(255,255,255,0.06)");

    // Shock axis line
    g.append("line")
      .attr("x1", x(0)).attr("x2", x(0))
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "rgba(255, 209, 102, 0.5)")
      .attr("stroke-dasharray", "4 4");
    g.append("text")
      .attr("x", x(0) + 6).attr("y", 14)
      .attr("fill", "var(--conflict-2)")
      .attr("font-size", 11).attr("font-weight", 600)
      .text("shock");

    // X label
    svg.append("text")
      .attr("x", W / 2).attr("y", H - 6)
      .attr("text-anchor", "middle")
      .attr("fill", "#7c8499").attr("font-size", 11)
      .attr("letter-spacing", "0.1em")
      .text("MONTHS SINCE SHOCK");

    // Lines
    const line = d3.line()
      .defined((d) => d.value != null)
      .x((d) => x(d.offset))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    series.forEach((s) => {
      // Area fill below
      const area = d3.area()
        .defined((d) => d.value != null)
        .x((d) => x(d.offset))
        .y0(innerH)
        .y1((d) => y(d.value))
        .curve(d3.curveMonotoneX);
      g.append("path")
        .datum(s.data)
        .attr("fill", s.color)
        .attr("fill-opacity", 0.12)
        .attr("d", area);
      g.append("path")
        .datum(s.data)
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", 2.2)
        .attr("d", line);

      // Peak annotation
      const peak = s.data.reduce((acc, d) => (acc == null || (d.value ?? -1) > (acc.value ?? -1)) ? d : acc, null);
      if (peak && peak.value != null) {
        g.append("circle")
          .attr("cx", x(peak.offset)).attr("cy", y(peak.value))
          .attr("r", 4).attr("fill", s.color);
        g.append("text")
          .attr("x", x(peak.offset))
          .attr("y", y(peak.value) - 10)
          .attr("text-anchor", "middle")
          .attr("fill", s.color)
          .attr("font-size", 12).attr("font-weight", 700)
          .text("€" + Math.round(peak.value));
      }
    });

    // Legend
    const legend = document.getElementById("compare-legend");
    legend.innerHTML = series.map((s) =>
      `<span class="cmp-leg-item"><i style="background:${s.color}"></i>${s.label}</span>`
    ).join("");
  }

  document.addEventListener("DOMContentLoaded", () => PC.ready.then(init));
})();

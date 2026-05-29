// Animated bar race: top-10 priciest grids, reorders as the slider moves.
(function () {
  const TOP_N = 10;
  let host, svg, g, x, y, color;
  const margin = { top: 12, right: 90, bottom: 20, left: 70 };
  const ROW_H = 26;
  const HEIGHT = margin.top + margin.bottom + ROW_H * TOP_N;

  function init() {
    host = document.getElementById("bar-race");
    if (!host) return;

    color = d3.scaleSequential()
      .domain([20, 400])
      .interpolator(d3.interpolateRgbBasis(["#2ec4b6", "#f5d76e", "#ff7676", "#c92a2a"]))
      .clamp(true);

    PC.on("monthIndex", () => render());
    PC.on("conflict", () => render());
    PC.on("stage", () => render());

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) render(); });
    }, { threshold: 0.05 });
    io.observe(host);

    window.addEventListener("resize", render);

    render();
  }

  function render() {
    if (!host) return;
    // Bail when the map page isn't visible yet
    if (host.clientWidth < 100) return;
    const idx = PC.state.monthIndex;
    const data = PC.data.prices;

    // Top-N countries by price at the slider date
    const rows = data.countries
      .map((c) => ({ c, v: data.values[c]?.[idx] }))
      .filter((d) => d.v != null)
      .sort((a, b) => b.v - a.v)
      .slice(0, TOP_N);

    const W = host.clientWidth;
    if (!svg) {
      svg = d3.select(host).append("svg")
        .attr("viewBox", `0 0 ${W} ${HEIGHT}`);
      g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    } else {
      svg.attr("viewBox", `0 0 ${W} ${HEIGHT}`);
    }
    const innerW = W - margin.left - margin.right;
    const innerH = HEIGHT - margin.top - margin.bottom;

    x = d3.scaleLinear()
      .domain([0, Math.max(d3.max(rows, (d) => d.v) * 1.1, 100)])
      .range([0, innerW]);
    y = d3.scaleBand()
      .domain(d3.range(TOP_N))
      .range([0, innerH])
      .padding(0.18);

    // X axis at the top
    let axisG = g.select(".axis-x");
    if (axisG.empty()) {
      axisG = g.append("g").attr("class", "axis-x");
    }
    axisG
      .call(d3.axisTop(x).ticks(5).tickFormat((d) => "€" + d).tickSize(-innerH))
      .selectAll("text").attr("fill", "#b6bccb").attr("font-size", 11);
    axisG.selectAll("path").attr("stroke", "transparent");
    axisG.selectAll("line").attr("stroke", "rgba(255,255,255,0.06)");

    // Bars are keyed by country code so D3 can animate reorder
    const bars = g.selectAll("g.bar").data(rows, (d) => d.c);
    bars.exit()
      .transition().duration(380)
      .attr("transform", (_, i) => `translate(0,${innerH + 40})`)
      .style("opacity", 0)
      .remove();

    const enter = bars.enter().append("g").attr("class", "bar")
      .attr("transform", (_, i) => `translate(0,${y(i)})`)
      .style("opacity", 0);

    enter.append("rect")
      .attr("x", 0).attr("y", 0)
      .attr("rx", 4)
      .attr("height", y.bandwidth())
      .attr("width", 0);
    enter.append("text").attr("class", "bar-name")
      .attr("x", -10).attr("y", y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", "#f1f3f8")
      .attr("font-size", 12).attr("font-weight", 600);
    enter.append("text").attr("class", "bar-value")
      .attr("y", y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("fill", "#f1f3f8")
      .attr("font-size", 12).attr("font-weight", 700);

    const merged = enter.merge(bars);
    merged
      .transition().duration(420).ease(d3.easeCubicInOut)
      .attr("transform", (_, i) => `translate(0,${y(i)})`)
      .style("opacity", 1);

    merged.select("rect")
      .transition().duration(420)
      .attr("width", (d) => x(d.v))
      .attr("fill", (d) => color(d.v));
    merged.select(".bar-name")
      .text((d) => PC.countryNames[d.c] || d.c);
    merged.select(".bar-value")
      .transition().duration(420)
      .attr("x", (d) => x(d.v) + 6)
      .tween("text", function (d) {
        const node = this;
        const prev = +(node.dataset.last || 0);
        const i = d3.interpolateNumber(prev, d.v);
        return (t) => { node.textContent = "€" + Math.round(i(t)); };
      })
      .on("end", function (d) { this.dataset.last = d.v; });
  }

  document.addEventListener("DOMContentLoaded", () => PC.ready.then(init));
})();

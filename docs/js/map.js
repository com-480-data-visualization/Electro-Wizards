// Europe choropleth. Reacts to monthIndex from the floating timebar.
(function () {
  let svg, g, pathGen, projection, countriesNode, tooltipEl, colorScale;

  function init() {
    const prices = PC.data.prices;
    const world = PC.data.world;

    colorScale = d3.scaleSequential()
      .domain([20, 350])
      .interpolator(d3.interpolateRgbBasis(["#2ec4b6", "#f5d76e", "#ff7676", "#c92a2a"]))
      .clamp(true);

    // -- SVG setup --
    const container = document.getElementById("map-svg-container");
    const VW = 800;
    const VH = 540;
    svg = d3.select(container).append("svg")
      .attr("viewBox", `0 0 ${VW} ${VH}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    g = svg.append("g");

    projection = d3.geoMercator()
      .center([14, 53])
      .scale(VW * 0.8)
      .translate([VW / 2, VH / 2 + 30]);

    pathGen = d3.geoPath().projection(projection);

    tooltipEl = d3.select("body").append("div").attr("class", "country-tip");

    const features = topojson.feature(world, world.objects.countries).features;

    countriesNode = g.selectAll("path.country-path")
      .data(features)
      .enter()
      .append("path")
      .attr("class", "country-path")
      .attr("d", pathGen)
      .attr("fill", "#1a1f2e")
      .attr("stroke", "rgba(255,255,255,0.15)")
      .attr("stroke-width", 0.5)
      .on("mousemove", function (event, d) {
        const iso2 = isoFor(d);
        const name = (iso2 && PC.countryNames[iso2]) || d.properties.name || "—";
        const v = priceFor(iso2, PC.state.monthIndex);
        const clickable = !!(iso2 && PC.data.prices.values[iso2]);
        tooltipEl
          .style("opacity", 1)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px")
          .html(`<strong>${name}</strong>
                 <span class="tip-price">${PC.fmt.eurMWh(v)}</span>
                 ${clickable ? "<span style='font-size:11px;color:var(--ink-mute);display:block;margin-top:3px;'>click to drill in →</span>" : ""}`);
      })
      .on("mouseout", () => tooltipEl.style("opacity", 0))
      .on("click", function (event, d) {
        const iso2 = isoFor(d);
        if (!iso2) return;
        // Ignore countries without price data; nudge the user instead.
        if (!PC.data.prices.values[iso2]) {
          PC.nudge && PC.nudge("No price data for this country.");
          return;
        }
        // Mark selection in store -- the production chart and shelf will
        // follow this via PC.on("selectedCountry").
        PC.set({ selectedCountry: iso2 });
        // Unlock the rest of the page (the user has done both required gates).
        PC.setStage && PC.setStage("open");
        // Highlight on the map.
        countriesNode.classed("selected", (dd) => isoFor(dd) === iso2);
        // Dismiss the "click a country" hint.
        const hint = document.getElementById("map-hint");
        if (hint) hint.classList.add("dismissed");
        // No auto-scroll: the drill panel CTA is how the user moves down.
      });

    renderLegend();

    PC.on("conflict", () => onConflictChange());
    PC.on("monthIndex", () => render());
    PC.on("selectedCountry", (c) => {
      countriesNode.classed("selected", (dd) => isoFor(dd) === c);
    });

    onConflictChange();
  }

  function onConflictChange() {
    if (!PC.state.conflict) return;
    const cw = PC.conflictWindow();
    const dates = PC.data.prices.dates;
    let idx = dates.indexOf(cw.before);
    if (idx < 0) idx = 0;
    PC.set({ monthIndex: idx });
  }

  function isoFor(feature) {
    if (feature.id && PC.isoNumTo2[feature.id]) return PC.isoNumTo2[feature.id];
    const p = feature.properties || {};
    if (p.iso_a2 && p.iso_a2 !== "-99") return p.iso_a2;
    return PC.iso3to2[p.iso_a3] || null;
  }

  function priceFor(iso2, idx) {
    if (!iso2) return null;
    const arr = PC.data.prices.values[iso2];
    if (!arr) return null;
    return arr[idx];
  }

  function render() {
    const idx = PC.state.monthIndex;
    const dates = PC.data.prices.dates;
    const date = dates[idx];

    countriesNode
      .transition().duration(180)
      .attr("fill", (d) => {
        const iso2 = isoFor(d);
        const v = priceFor(iso2, idx);
        if (v == null) return "#1a1f2e";
        return colorScale(v);
      });

    const vals = [];
    Object.values(PC.data.prices.values).forEach((arr) => {
      const v = arr[idx];
      if (v != null) vals.push(v);
    });
    const avg = vals.length ? d3.mean(vals) : null;
    const avgEl = document.getElementById("map-avg-price");
    const subEl = document.getElementById("map-avg-sub");
    if (avgEl) avgEl.textContent = avg == null ? "—" : "€" + Math.round(avg);
    if (subEl) subEl.textContent = `monthly mean · ${date}`;

    // Event card
    const ev = PC.findEvent(date);
    const evDateEl = document.getElementById("event-date");
    const evTitleEl = document.getElementById("event-title");
    const evDescEl = document.getElementById("event-desc");
    if (!evDateEl) return;
    if (ev) {
      evDateEl.textContent = humanDate(ev.date);
      evTitleEl.textContent = ev.title;
      evDescEl.textContent = ev.desc;
    } else if (PC.state.conflict) {
      evDateEl.textContent = humanDate(date);
      evTitleEl.textContent = "Calm before the storm";
      evDescEl.textContent = "No major event yet on this conflict's timeline. Slide forward to watch the shock arrive.";
    } else {
      evDateEl.textContent = humanDate(date);
      evTitleEl.textContent = "Pick a conflict above to see annotated events";
      evDescEl.textContent = "";
    }
  }

  function humanDate(iso) {
    if (!iso) return "—";
    const [y, m] = iso.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[+m - 1]} ${y}`;
  }

  function renderLegend() {
    const el = document.getElementById("map-legend");
    if (!el) return;
    el.innerHTML = `
      <div class="map-legend-title">Day-ahead price · €/MWh</div>
      <div class="legend-bar"></div>
      <div class="legend-labels"><span>20</span><span>100</span><span>200</span><span>350+</span></div>
    `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    PC.ready.then(init);
  });
})();

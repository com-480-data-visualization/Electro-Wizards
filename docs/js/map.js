/* Choropleth of monthly day-ahead electricity prices in Europe. */
(function () {
  let svg, g, pathGen, projection, countriesNode, tooltipEl, colorScale;
  let playing = false, playTimer = null;

  function init() {
    const prices = PC.data.prices;
    const world = PC.data.world;

    // Build the color scale (€/MWh). Use a perceptual diverging-ish scale.
    // Range up to ~500 captures the 2022 spikes without being dominated by them.
    const allValues = [];
    Object.values(prices.values).forEach((arr) => arr.forEach((v) => v != null && allValues.push(v)));
    colorScale = d3.scaleSequential()
      .domain([20, 350])
      .interpolator(d3.interpolateRgbBasis(["#2ec4b6", "#f5d76e", "#ff7676", "#c92a2a"]))
      .clamp(true);

    // -- SVG setup -- use a fixed viewBox so projection doesn't depend on
    // the container's measured width at init time (it can be 0 if hidden).
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

    // -- Tooltip --
    tooltipEl = d3.select("body").append("div")
      .attr("class", "country-tip");

    // -- Countries --
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
        tooltipEl
          .style("opacity", 1)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px")
          .html(`<strong>${name}</strong><span class="tip-price">${PC.fmt.eurMWh(v)}</span>`);
      })
      .on("mouseout", () => tooltipEl.style("opacity", 0));

    // -- Slider --
    const slider = document.getElementById("time-slider");
    slider.max = prices.dates.length - 1;
    slider.value = 0;
    slider.addEventListener("input", (e) => {
      PC.set({ monthIndex: +e.target.value });
    });

    // Play button
    const playBtn = document.getElementById("play-btn");
    playBtn.addEventListener("click", togglePlay);

    // -- Legend --
    renderLegend();

    // React when conflict / monthIndex changes
    PC.on("conflict", () => onConflictChange());
    PC.on("monthIndex", () => render());

    // Initial state: focus on the conflict's pre-shock month or the first month.
    onConflictChange();
  }

  function onConflictChange() {
    const cw = PC.conflictWindow();
    const dates = PC.data.prices.dates;
    let idx = dates.indexOf(cw.before);
    if (idx < 0) idx = 0;
    document.getElementById("time-slider").value = idx;
    PC.set({ monthIndex: idx });
  }

  function isoFor(feature) {
    // world-atlas TopoJSON exposes a numeric ISO 3166-1 code in `id`.
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

    // Big stat: average across reporting countries
    const vals = [];
    Object.values(PC.data.prices.values).forEach((arr) => {
      const v = arr[idx];
      if (v != null) vals.push(v);
    });
    const avg = vals.length ? d3.mean(vals) : null;
    document.getElementById("map-avg-price").textContent = avg == null ? "—" : "€" + Math.round(avg);
    document.getElementById("map-avg-sub").textContent = `monthly mean · ${date}`;

    document.getElementById("slider-readout").textContent = humanDate(date);

    // Event card
    const ev = PC.findEvent(date);
    const evDateEl = document.getElementById("event-date");
    const evTitleEl = document.getElementById("event-title");
    const evDescEl = document.getElementById("event-desc");
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
    el.innerHTML = `
      <div class="map-legend-title">Day-ahead price · €/MWh</div>
      <div class="legend-bar"></div>
      <div class="legend-labels"><span>20</span><span>100</span><span>200</span><span>350+</span></div>
    `;
  }

  function togglePlay() {
    const btn = document.getElementById("play-btn");
    const slider = document.getElementById("time-slider");
    const max = +slider.max;

    if (playing) {
      playing = false;
      clearInterval(playTimer);
      btn.textContent = "▶";
      btn.classList.remove("playing");
      return;
    }
    playing = true;
    btn.textContent = "❚❚";
    btn.classList.add("playing");

    if (PC.state.monthIndex >= max) PC.set({ monthIndex: 0 });

    playTimer = setInterval(() => {
      const next = PC.state.monthIndex + 1;
      if (next > max) {
        clearInterval(playTimer);
        playing = false;
        btn.textContent = "▶";
        btn.classList.remove("playing");
        return;
      }
      slider.value = next;
      PC.set({ monthIndex: next });
    }, 280);
  }

  document.addEventListener("DOMContentLoaded", () => {
    PC.ready.then(init);
  });
})();

/* Conflict receipt: itemised before / peak / latest prices for the basket. */
(function () {
  let pillEl;

  function init() {
    pillEl = document.getElementById("basket-pill");

    PC.on("basket", () => render());
    PC.on("shelfCountry", () => render());
    PC.on("conflict", () => render());

    document.getElementById("btn-clear").addEventListener("click", () => {
      PC.set({ basket: [] });
    });

    render();
  }

  function priceAtNearest(item, country, isoMonth) {
    const it = PC.data.items.data[item];
    if (!it) return null;
    const arr = it.countries[country];
    if (!arr) return null;
    let i = it.dates.indexOf(isoMonth);
    if (i < 0) {
      i = it.dates.findIndex((d) => d >= isoMonth);
      if (i < 0) i = it.dates.length - 1;
    }
    if (arr[i] != null) return arr[i];
    for (let off = 1; off < 12; off++) {
      if (i - off >= 0 && arr[i - off] != null) return arr[i - off];
      if (i + off < arr.length && arr[i + off] != null) return arr[i + off];
    }
    return null;
  }

  function peakPrice(item, country, fromMonth) {
    const it = PC.data.items.data[item];
    if (!it) return null;
    const arr = it.countries[country];
    if (!arr) return null;
    const start = Math.max(0, it.dates.findIndex((d) => d >= fromMonth));
    let max = null;
    for (let i = start; i < arr.length; i++) {
      if (arr[i] != null && (max == null || arr[i] > max)) max = arr[i];
    }
    return max;
  }
  function latestPrice(item, country) {
    const it = PC.data.items.data[item];
    if (!it) return null;
    const arr = it.countries[country];
    if (!arr) return null;
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
    return null;
  }

  function render() {
    const basket = PC.state.basket;
    const country = PC.state.shelfCountry;
    const cw = PC.conflictWindow();

    document.getElementById("receipt-country").textContent =
      PC.countryNames[country] || country;

    const itemsHost = document.getElementById("receipt-items");
    const totalsHost = document.getElementById("receipt-totals");
    const metaHost = document.getElementById("receipt-meta");

    if (!basket.length) {
      itemsHost.innerHTML = `
        <div class="receipt-item-row" style="grid-template-columns:1fr;color:#777;">
          (Add items from the shelf above)
        </div>`;
      totalsHost.innerHTML = "";
      metaHost.textContent = "Empty basket — wander up to the shelf.";
      updatePill(0);
      return;
    }

    metaHost.textContent =
      `Before: ${prettyMonth(cw.before)} · Peak: ${prettyMonth(cw.peak)} · Latest: ${prettyMonth(latestMonth())}`;

    let header = `
      <div class="receipt-item-row" style="font-weight:700;">
        <span class="name">Item</span>
        <span class="col-before">Before</span>
        <span class="col-peak">Peak</span>
        <span class="col-now">Latest</span>
      </div>`;

    let totalBefore = 0, totalPeak = 0, totalNow = 0;
    let countedBefore = 0, countedPeak = 0, countedNow = 0;

    const rows = basket.map((item) => {
      const before = priceAtNearest(item, country, cw.before);
      const peak = peakPrice(item, country, cw.shock);
      const now = latestPrice(item, country);

      if (before != null) { totalBefore += before; countedBefore++; }
      if (peak != null) { totalPeak += peak; countedPeak++; }
      if (now != null) { totalNow += now; countedNow++; }

      const unit = item === "Electricity" ? " /kWh" : " /kg";
      return `
        <div class="receipt-item-row">
          <span class="name">${PC.itemEmoji[item] || "·"} ${item}</span>
          <span class="col-before">${fmt(before)}${unit}</span>
          <span class="col-peak">${fmt(peak)}${unit}</span>
          <span class="col-now">${fmt(now)}${unit}</span>
        </div>`;
    }).join("");

    itemsHost.innerHTML = header + rows;

    const deltaPeak = totalBefore > 0 && countedPeak === basket.length
      ? totalPeak - totalBefore : null;
    const deltaNow = totalBefore > 0 && countedNow === basket.length
      ? totalNow - totalBefore : null;

    totalsHost.innerHTML = `
      <div class="totals-row"><span>Subtotal · before</span><span>${fmt(totalBefore)}</span></div>
      <div class="totals-row"><span>Subtotal · peak of shock</span><span>${fmt(totalPeak)}</span></div>
      <div class="totals-row"><span>Subtotal · latest</span><span>${fmt(totalNow)}</span></div>
      ${deltaPeak != null ? `<div class="totals-row delta">
        <span>What the shock added (peak − before)</span>
        <span class="v">${deltaPeak >= 0 ? "+" : ""}${fmt(deltaPeak)}</span>
      </div>` : ""}
      ${deltaNow != null ? `<div class="totals-row delta">
        <span>What's left in the trolley today</span>
        <span class="v">${deltaNow >= 0 ? "+" : ""}${fmt(deltaNow)}</span>
      </div>` : ""}
    `;

    updatePill(basket.length);
  }

  function updatePill(n) {
    document.getElementById("basket-count").textContent = n;
    pillEl.classList.toggle("show", n > 0);
  }

  function fmt(v) {
    return v == null ? "—" : "€" + v.toFixed(2);
  }
  function prettyMonth(iso) {
    if (!iso) return "—";
    const [y, m] = iso.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[+m - 1]} ${y}`;
  }
  function latestMonth() {
    const dates = PC.data.items.data["Bread"]?.dates || [];
    return dates[dates.length - 1] || "—";
  }

  document.addEventListener("DOMContentLoaded", () => {
    PC.ready.then(init);
  });
})();

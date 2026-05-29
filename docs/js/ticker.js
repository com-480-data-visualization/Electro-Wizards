// News pill + newspaper overlay. Auto-pops once when the slider crosses onto
// a new event, then waits for the next event before doing it again.
(function () {
  let lastEventDate = null;     // date of the event that was active on the previous tick
  let autoOpenedFor = null;     // date of the event we auto-opened (so we don't re-open the same one)
  let initialized = false;      // skip auto-open on the very first render after page load / conflict pick
  let mapInView = false;        // is the map section currently on screen?

  function init() {
    PC.on("monthIndex", () => update());
    PC.on("conflict", () => { lastEventDate = null; autoOpenedFor = null; initialized = false; update(); });

    document.getElementById("ticker-pill").addEventListener("click", () => {
      // Pill click reveals the newspaper for the current event regardless of
      // which section the user is on (so the floating timebar always works).
      const ev = currentEvent();
      if (ev) openOverlay(ev, /*force=*/true);
    });

    document.querySelectorAll("[data-newspaper-close]").forEach((el) => {
      el.addEventListener("click", () => closeOverlay());
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeOverlay();
    });

    // Newspaper auto-shows only while the map is in view.
    const mapSection = document.getElementById("map");
    if (mapSection) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          mapInView = e.isIntersecting;
          if (!mapInView) closeOverlay();
        });
      }, { threshold: 0.2 });
      io.observe(mapSection);
    }

    update();
  }

  function currentEvent() {
    const date = PC.data.prices.dates[PC.state.monthIndex];
    return PC.findEvent(date);
  }

  function update() {
    const dateEl = document.getElementById("ticker-date");
    const textEl = document.getElementById("ticker-text");
    if (!textEl) return;

    const date = PC.data.prices.dates[PC.state.monthIndex];
    const ev = PC.findEvent(date);

    if (!PC.state.conflict) {
      dateEl.textContent = "—";
      textEl.textContent = "Pick a conflict to follow the news.";
      return;
    }
    if (ev) {
      dateEl.textContent = prettyDate(ev.date);
      const nextText = ev.headline || ev.title;
      if (textEl.textContent !== nextText) {
        textEl.style.opacity = 0;
        setTimeout(() => { textEl.textContent = nextText; textEl.style.opacity = 1; }, 140);
      }

      // Auto-open when the active event changes, but not on the first render
      // after a conflict pick, and only while the map is in view.
      if (initialized && mapInView && ev.date !== lastEventDate && ev.date !== autoOpenedFor) {
        openOverlay(ev);
        autoOpenedFor = ev.date;
      }
      lastEventDate = ev.date;
    } else {
      dateEl.textContent = prettyDate(date);
      textEl.textContent = "Calm period, no event on the timeline yet.";
      lastEventDate = null;
    }
    initialized = true;
  }

  function openOverlay(ev) {
    const o = document.getElementById("newspaper");
    document.getElementById("np-source").textContent = ev.source || "Source";
    document.getElementById("np-date").textContent = prettyDate(ev.date);
    document.getElementById("np-headline").textContent = ev.headline || ev.title;
    document.getElementById("np-desc").textContent = ev.desc;
    document.getElementById("np-impact").querySelector(".newspaper-impact-text")
      .textContent = ev.mix_impact || "—";
    const link = document.getElementById("np-link");
    link.href = ev.url || "#";

    o.hidden = false;
    requestAnimationFrame(() => o.classList.add("show"));
  }

  function closeOverlay() {
    const o = document.getElementById("newspaper");
    o.classList.remove("show");
    setTimeout(() => { o.hidden = true; }, 320);
  }

  function prettyDate(iso) {
    if (!iso) return "—";
    const [y, m] = iso.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[+m - 1]} ${y}`;
  }

  document.addEventListener("DOMContentLoaded", () => PC.ready.then(init));
})();

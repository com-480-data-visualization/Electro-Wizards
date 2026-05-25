/* Scroll-lock state machine.
 *
 *  STAGES:
 *    hero   -> can scroll between hero and choice
 *    choice -> conflict picked; map section becomes visible
 *    map    -> country picked; everything else becomes visible
 *
 *  We progress one-way only: hero -> choice -> map -> open. A "Reset" button
 *  drops us back to the hero stage.
 *
 *  Implementation: a class on <body> ("stage-hero" / "stage-choice" /
 *  "stage-map" / nothing) drives `display: none` rules on later sections. A
 *  small toast nudges the user when they try to scroll past the gate.
 */
(function () {
  const STAGES = ["hero", "choice", "map", "open"];

  PC.stage = "hero";
  PC.stageRank = (s) => STAGES.indexOf(s);

  PC.setStage = function (next) {
    if (PC.stageRank(next) <= PC.stageRank(PC.stage)) return; // one-way only
    PC.stage = next;
    applyStage();
  };

  PC.resetStage = function () {
    PC.stage = "hero";
    applyStage();
  };

  function applyStage() {
    document.body.classList.remove("stage-hero", "stage-choice", "stage-map", "stage-open");
    document.body.classList.add("stage-" + PC.stage);

    // unlock nav links
    const unlockMap = {
      hero: [],
      choice: ["hero", "choice"],
      map: ["hero", "choice", "map"],
      open: ["hero", "choice", "map", "production", "shelf", "receipt", "compare", "conclusion"],
    };
    const unlocked = new Set(unlockMap[PC.stage] || []);
    document.querySelectorAll(".nav-links a").forEach((a) => {
      const target = a.dataset.nav;
      if (unlocked.has(target)) a.classList.add("unlocked");
      else a.classList.remove("unlocked");
    });

    // Show / hide timebar (visible once the map page is reachable, i.e. >= choice)
    const tb = document.getElementById("timebar");
    if (tb) {
      const show = PC.stage !== "hero";
      tb.hidden = !show;
      if (show) requestAnimationFrame(() => tb.classList.add("show"));
      else tb.classList.remove("show");
    }

    PC.set({ stage: PC.stage });
  }

  // Toast nudge
  let toastTimer = null;
  PC.nudge = function (text) {
    const t = document.getElementById("lock-toast");
    if (!t) return;
    t.querySelector("#lock-toast-text").textContent = text;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => { t.hidden = true; }, 240);
    }, 2400);
  };

  function init() {
    applyStage();

    // Intercept attempts to scroll/jump past a lock
    document.addEventListener("click", (ev) => {
      const a = ev.target.closest("a[href^='#']");
      if (!a) return;
      const target = a.getAttribute("href").slice(1);
      const targetStage =
        target === "map" ? "choice" :
        target === "production" || target === "shelf" || target === "receipt" ? "map" :
        null;
      if (!targetStage) return;
      if (PC.stageRank(PC.stage) < PC.stageRank(targetStage)) {
        ev.preventDefault();
        const msg = targetStage === "choice"
          ? "Pick a conflict above first."
          : "Click a country on the map first.";
        PC.nudge(msg);
      }
    });

    // Reset button
    const reset = document.getElementById("nav-reset");
    if (reset) reset.addEventListener("click", () => {
      PC.set({ conflict: null, basket: [], selectedCountry: null });
      PC.resetStage();
      document.getElementById("hero").scrollIntoView({ behavior: "smooth" });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    PC.ready.then(init);
  });
})();

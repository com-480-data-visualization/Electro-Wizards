/* Conflict-choice page wiring + body class swap for palette. */
(function () {
  function init() {
    const cards = document.querySelectorAll(".conflict-card");
    const labelEls = document.querySelectorAll("[data-conflict-label]");
    const bgEls = document.querySelectorAll("[data-conflict-bg]");

    function applyConflict(conflict) {
      document.body.classList.remove("conflict-ukraine", "conflict-iran");
      if (conflict) document.body.classList.add("conflict-" + conflict);

      cards.forEach((c) => {
        c.setAttribute("aria-pressed", c.dataset.conflict === conflict ? "true" : "false");
      });

      if (conflict && PC.data.timeline) {
        const tl = PC.data.timeline[conflict];
        labelEls.forEach((el) => { el.textContent = tl.label; });
      }
    }

    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const c = card.dataset.conflict;
        PC.set({ conflict: c });
        applyConflict(c);
        // smooth scroll to the next page
        document.getElementById("map").scrollIntoView({ behavior: "smooth" });
      });
    });

    // Re-apply if the state changes elsewhere (e.g. nav reset)
    PC.on("conflict", (c) => applyConflict(c));

    // Reset button
    const reset = document.getElementById("nav-reset");
    if (reset) {
      reset.addEventListener("click", () => {
        PC.set({ conflict: null, basket: [], monthIndex: 0 });
        applyConflict(null);
        document.getElementById("hero").scrollIntoView({ behavior: "smooth" });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    PC.ready.then(init);
  });
})();

// Conflict-choice page: clicking a flag sets the conflict + swaps the palette.
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
        // Advance the lock state machine and scroll to the map.
        PC.setStage("choice");
        // Give the lock state machine a tick to flip visibility on #map.
        setTimeout(() => {
          document.getElementById("map").scrollIntoView({ behavior: "smooth" });
        }, 50);
      });
    });

    // Re-apply if the state changes elsewhere (e.g. nav reset)
    PC.on("conflict", (c) => applyConflict(c));
  }

  document.addEventListener("DOMContentLoaded", () => {
    PC.ready.then(init);
  });
})();

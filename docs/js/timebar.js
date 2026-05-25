/* The persistent floating timebar (slider + 2 play buttons + ticker mount).
 * Owns the slider/play UI; the actual monthIndex lives in PC.state. */
(function () {
  let playing = false;       // is any play button active?
  let playTimer = null;
  let activeBtnId = null;    // id of the currently-playing button

  function init() {
    const dates = PC.data.prices.dates;
    const slider = document.getElementById("time-slider");
    const slowBtn = document.getElementById("play-btn-slow");
    const fastBtn = document.getElementById("play-btn-fast");
    const readout = document.getElementById("slider-readout");
    if (!slider) return;

    slider.min = 0;
    slider.max = dates.length - 1;
    slider.value = PC.state.monthIndex || 0;

    slider.addEventListener("input", (e) => {
      PC.set({ monthIndex: +e.target.value });
    });

    [slowBtn, fastBtn].forEach((btn) => {
      btn.addEventListener("click", () => {
        const speed = +btn.dataset.speed;
        // Click the active button -> stop. Click a different button -> switch speeds.
        if (playing && activeBtnId === btn.id) {
          stop();
        } else {
          start(btn, speed);
        }
      });
    });

    PC.on("monthIndex", (idx) => {
      slider.value = idx;
      readout.textContent = humanDate(dates[idx]);
    });

    readout.textContent = humanDate(dates[PC.state.monthIndex || 0]);
  }

  function start(btn, intervalMs) {
    // Reset other buttons' visuals
    document.querySelectorAll(".play-btn").forEach((b) => {
      b.classList.remove("playing");
      b.textContent = b.dataset.label || b.textContent;
    });
    // Remember original label for the "stop" toggle and replace with pause icon
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = "❚❚";
    btn.classList.add("playing");

    if (playTimer) clearInterval(playTimer);
    playing = true;
    activeBtnId = btn.id;

    const slider = document.getElementById("time-slider");
    const max = +slider.max;
    if (PC.state.monthIndex >= max) PC.set({ monthIndex: 0 });

    playTimer = setInterval(() => {
      const next = PC.state.monthIndex + 1;
      if (next > max) {
        stop();
        return;
      }
      PC.set({ monthIndex: next });
    }, intervalMs);
  }

  function stop() {
    if (playTimer) clearInterval(playTimer);
    playing = false;
    activeBtnId = null;
    document.querySelectorAll(".play-btn").forEach((b) => {
      b.classList.remove("playing");
      if (b.dataset.label) b.textContent = b.dataset.label;
    });
  }

  function humanDate(iso) {
    if (!iso) return "—";
    const [y, m] = iso.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[+m - 1]} ${y}`;
  }

  document.addEventListener("DOMContentLoaded", () => PC.ready.then(init));
})();

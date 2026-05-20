/* The persistent floating timebar (slider + play + ticker mount).
 * Owns the slider/play UI; the actual monthIndex lives in PC.state. */
(function () {
  let playing = false, playTimer = null;

  function init() {
    const dates = PC.data.prices.dates;
    const slider = document.getElementById("time-slider");
    const playBtn = document.getElementById("play-btn");
    const readout = document.getElementById("slider-readout");
    if (!slider) return;

    slider.min = 0;
    slider.max = dates.length - 1;
    slider.value = PC.state.monthIndex || 0;

    slider.addEventListener("input", (e) => {
      PC.set({ monthIndex: +e.target.value });
    });

    playBtn.addEventListener("click", togglePlay);

    PC.on("monthIndex", (idx) => {
      slider.value = idx;
      readout.textContent = humanDate(dates[idx]);
    });

    // Initial readout
    readout.textContent = humanDate(dates[PC.state.monthIndex || 0]);
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
      PC.set({ monthIndex: next });
    }, 280);
  }

  function humanDate(iso) {
    if (!iso) return "—";
    const [y, m] = iso.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[+m - 1]} ${y}`;
  }

  document.addEventListener("DOMContentLoaded", () => PC.ready.then(init));
})();

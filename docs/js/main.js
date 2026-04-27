/* Reveal-on-scroll for page headers + small UX helpers. */
(function () {
  function init() {
    const headers = document.querySelectorAll(".page-header, .conflict-card");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.style.opacity = 1;
            e.target.style.transform = "translateY(0)";
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    headers.forEach((el) => {
      el.style.opacity = 0;
      el.style.transform = "translateY(18px)";
      el.style.transition = "opacity 600ms ease, transform 600ms cubic-bezier(.2,.8,.2,1)";
      io.observe(el);
    });
  }

  document.addEventListener("DOMContentLoaded", () => PC.ready.then(init));
})();

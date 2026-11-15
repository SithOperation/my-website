(function () {
    "use strict";

    const button = document.getElementById("back-to-top");
    if (!button) return;

    const updateVisibility = () => {
        button.classList.toggle("is-visible", window.scrollY > 500);
    };

    button.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
    });
    window.addEventListener("scroll", updateVisibility, { passive: true });
    updateVisibility();
}());

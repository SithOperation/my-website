const gsap = window.gsap;

function revealHomepage(home) {
    document.body.classList.remove("intro-active");
    home.classList.add("site-revealed");
    gsap.fromTo(
        [".hero", "nav", ".card"],
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: .7, stagger: .08, ease: "power2.out", clearProps: "opacity,transform" }
    );
}

function enterVaticanBackground(root, home) {
    root.classList.add("is-vatican-fallback", "is-vatican-background");
    root.classList.remove("is-earth-fallback", "is-fallback-transition");
    root.querySelector(".intro-ui")?.remove();
    root.removeAttribute("role");
    root.removeAttribute("aria-label");
    root.setAttribute("aria-hidden", "true");
    revealHomepage(home);
    sessionStorage.setItem("orbital-intro-seen", "true");
}

export async function runStaticIntro(root, { playSequence = true } = {}) {
    const home = document.querySelector(".overlay");
    const skip = root.querySelector(".intro-skip");
    root.classList.add("intro-static", "is-earth-fallback");

    let skipped = false;
    skip?.addEventListener("click", () => {
        skipped = true;
        enterVaticanBackground(root, home);
    }, { once: true });

    if (!playSequence) {
        enterVaticanBackground(root, home);
        return;
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    if (skipped) return;
    root.classList.add("is-fallback-transition");
    await new Promise(resolve => setTimeout(resolve, 700));
    if (!skipped) enterVaticanBackground(root, home);
}

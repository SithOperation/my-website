// Development switch: set false for normal once-per-session playback.
const ALWAYS_PLAY_INTRO = true;
// The generated 2D Earth-to-Vatican sequence is the preferred experience on all devices.
const USE_STATIC_CINEMATIC = true;

const failOpen = root => {
    root?.remove();
    document.body.classList.remove("intro-active");
    document.querySelector(".overlay")?.classList.add("site-revealed");
};

const start = async () => {
    const root = document.getElementById("cinematic-background");
    if (!root) {
        failOpen(root);
        return;
    }
    const alreadySeen = sessionStorage.getItem("orbital-intro-seen") === "true";
    try {
        const module = USE_STATIC_CINEMATIC
            ? await import("./fallback.js")
            : await import("./intro.js");
        const runner = USE_STATIC_CINEMATIC ? module.runStaticIntro : module.runIntro;
        await runner(root, { playSequence: ALWAYS_PLAY_INTRO || !alreadySeen });
    } catch (error) {
        console.error("Orbital intro unavailable", error);
        failOpen(root);
    }
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();

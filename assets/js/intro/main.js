import { runIntro } from "./intro.js";

// Development switch: set false for normal once-per-session playback.
const ALWAYS_PLAY_INTRO = true;

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
        await runIntro(root, { playSequence: ALWAYS_PLAY_INTRO || !alreadySeen });
    } catch (error) {
        console.error("Orbital intro unavailable", error);
        failOpen(root);
    }
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();

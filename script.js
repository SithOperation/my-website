
// =====================
// TYPEWRITER EFFECT
// =====================

const text = "system online...";
let i = 0;

function type() {
    const el = document.getElementById("typing");
    if (!el) return;

    if (i === 0) el.innerHTML = "";

    if (i < text.length) {
        el.innerHTML += text.charAt(i);
        i++;
        setTimeout(type, 80);
    } else {
        el.innerHTML = text + '<span class="cursor">█</span>';
    }
}

type();


// =====================
// BACKGROUND ROTATION
// =====================

const backgrounds = [
    "assets/i-made-some-gifs-v0-9yugvn57e5o81.gif",
    "assets/i-made-some-gifs-v0-fphci857e5o81.gif",
    "assets/i-made-some-gifs-v0-uhn1le67e5o81.gif",
    "assets/i-made-some-gifs-v0-vv91pq57e5o81.gif"
];

let layers = [];
let current = 0;

function initBackgrounds() {
    layers = [
        document.getElementById("bg1"),
        document.getElementById("bg2"),
        document.getElementById("bg3")
    ];

    if (!layers[0]) return;

    layers[0].style.backgroundImage = `url(${backgrounds[0]})`;
    layers[0].style.opacity = 1;
}

function rotateBackground() {
    if (!layers.length) return;

    const next = (current + 1) % backgrounds.length;

    const active = layers[current % 3];
    const incoming = layers[next % 3];

    incoming.style.backgroundImage = `url(${backgrounds[next]})`;
    incoming.style.opacity = 1;

    active.style.opacity = 0;

    current = next;
}

initBackgrounds();
setInterval(rotateBackground, 8000);


// =====================
// PROJECT PHOTO TOGGLE
// =====================

let photosVisible = false;

function throwPhotos() {
    const layer = document.getElementById("photo-layer");
    if (!layer) return;

    // toggle off
    if (photosVisible) {
        layer.style.opacity = "0";

        setTimeout(() => {
            layer.innerHTML = "";
            layer.style.opacity = "1";
        }, 400);

        photosVisible = false;
        return;
    }

    layer.innerHTML = "";

    const images = [
        "assets/image1.jpg",
        "assets/image2.jpg",
        "assets/image3.jpg",
        "assets/image4.jpg",
        "assets/image5.jpg"
    ];

    const positions = [
        { left: "8%", top: "18%", rot: "-14deg" },
        { left: "33%", top: "8%", rot: "8deg" },
        { left: "60%", top: "16%", rot: "-7deg" },
        { left: "18%", top: "48%", rot: "10deg" },
        { left: "48%", top: "46%", rot: "-9deg" }
    ];

    images.forEach((src, index) => {
        const img = document.createElement("img");

        img.src = src;
        img.className = "throw-photo";

        const pos = positions[index];

        img.style.left = pos.left;
        img.style.top = pos.top;
        img.style.setProperty("--rot", pos.rot);

        layer.appendChild(img);
    });

    photosVisible = true;
}


// =====================
// OPTIONAL: SMOOTH SCROLL FIX
// =====================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
        e.preventDefault();

        const target = document.querySelector(this.getAttribute("href"));
        if (target) {
            target.scrollIntoView({ behavior: "smooth" });
        }
    });
});

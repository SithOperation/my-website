
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


// =====================
// PROJECT VIEWER SYSTEM
// =====================

function loadProject(project) {
    const viewer = document.getElementById("viewer-content");
    if (!viewer) return;

    let title = "";
    let text = "";
    let images = [];
    let pdf = "";

    if (project === "reddit") {
        title = "Reddit Threat Monitor";
        text = "Threat intelligence system that monitors Reddit for cybersecurity signals and suspicious activity patterns.";

        images = [
            "assets/image1.jpg",
            "assets/image2.jpg"
        ];

        pdf = "assets/projects/reddit-monitor.pdf";
    }

    else if (project === "ransomware") {
        title = "Healthcare Ransomware Defense";
        text = "Enterprise ransomware mitigation strategy designed for healthcare environments.";

        images = [
            "assets/image3.jpg",
            "assets/image4.jpg"
        ];

        pdf = "assets/projects/project2.pdf";
    }

    else if (project === "nestle") {
        title = "Nestle CIA Threat Table";
        text = "Risk analysis model based on CIA triad principles.";

        images = [
            "assets/image5.jpg"
        ];

        pdf = "assets/projects/project1.pdf";
    }

    // build image HTML
    let imageHTML = "";
    if (images.length > 0) {
        imageHTML = `
            <h4>Evidence / Screenshots</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
                ${images.map(img => `
                    <img src="${img}" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
                `).join("")}
            </div>
        `;
    }

    // build PDF embed (IMPORTANT FIX)
    let pdfHTML = "";
    if (pdf) {
        pdfHTML = `
            <h4 style="margin-top:15px;">Full Report</h4>
            <iframe
                src="${pdf}"
                style="width:100%;height:500px;border:none;border-radius:8px;background:white;">
            </iframe>

            <br>

            <a href="${pdf}" target="_blank"
               style="display:inline-block;margin-top:10px;padding:10px 14px;background:#00ffd5;color:black;border-radius:8px;text-decoration:none;">
                Open PDF in New Tab
            </a>
        `;
    }

    viewer.innerHTML = `
        <h3>${title}</h3>
        <p>${text}</p>

        ${imageHTML}
        ${pdfHTML}
    `;

    viewer.scrollIntoView({ behavior: "smooth", block: "center" });
}

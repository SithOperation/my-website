// =====================
// TYPEWRITER
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
        el.innerHTML += '<span class="cursor">█</span>';
    }
}

type();


// =====================
// PROJECT DATA
// =====================

const projects = {
    reddit: {
        title: "Reddit Threat Monitor",
        images: [
            "assets/projects/reddit/image1.jpg",
            "assets/projects/reddit/image2.jpg",
            "assets/projects/reddit/image3.jpg",
            "assets/projects/reddit/image4.jpg",
            "assets/projects/reddit/image5.jpg"
        ],
        pdf: null
    },

    ransomware: {
        title: "Healthcare Ransomware Defense",
        images: [],
        pdf: "assets/projects/project2.pdf"
    },

    nestle: {
        title: "Nestle CIA Threat Table",
        images: [],
        pdf: "assets/projects/project1.pdf"
    }
};


// =====================
// PROJECT VIEWER (FIXED)
// =====================

function loadProject(key) {
    const viewer = document.getElementById("viewer-content");
    const project = projects[key];

    if (!viewer || !project) return;

    let html = `<h2>${project.title}</h2>`;

    // IMAGES
    if (project.images && project.images.length > 0) {
        html += `<h3>Evidence</h3>`;
        project.images.forEach(img => {
            html += `<img src="${img}">`;
        });
    }

    // PDF
    if (project.pdf) {
        html += `
            <h3>Report</h3>
            <iframe src="${project.pdf}"></iframe>
            <a href="${project.pdf}" target="_blank" class="project">
                Open Full PDF
            </a>
        `;
    }

    viewer.innerHTML = html;

    viewer.scrollIntoView({ behavior: "smooth", block: "center" });
}


// =====================
// BACKGROUND GIF SYSTEM (STABLE VERSION)
// =====================

const gifs = [
    "assets/i-made-some-gifs-v0-9yugvn57e5o81.gif",
    "assets/i-made-some-gifs-v0-fphci857e5o81.gif",
    "assets/i-made-some-gifs-v0-uhn1le67e5o81.gif",
    "assets/i-made-some-gifs-v0-vv91pq57e5o81.gif"
];

// preload
gifs.forEach(src => {
    const img = new Image();
    img.src = src;
});

let index = 0;

const bg1 = document.getElementById("bg1");
const bg2 = document.getElementById("bg2");
const bg3 = document.getElementById("bg3");

function initBackground() {
    if (!bg1 || !bg2 || !bg3) return;

    bg1.style.backgroundImage = `url('${gifs[0]}')`;
    bg2.style.backgroundImage = `url('${gifs[1]}')`;
    bg3.style.backgroundImage = `url('${gifs[2]}')`;

    bg1.style.opacity = "1";
    bg2.style.opacity = "0";
    bg3.style.opacity = "0";
}

function rotateBackground() {
    if (!bg1 || !bg2 || !bg3) return;

    index = (index + 1) % gifs.length;

    const next = gifs[index];

    // shift visuals DOWN the pipeline (NOT array swapping)
    bg1.style.backgroundImage = bg2.style.backgroundImage;
    bg2.style.backgroundImage = bg3.style.backgroundImage;
    bg3.style.backgroundImage = `url('${next}')`;

    // fade control (stable)
    bg3.style.opacity = "1";
    bg2.style.opacity = "0.6";
    bg1.style.opacity = "0.2";

    setTimeout(() => {
        bg1.style.backgroundImage = bg2.style.backgroundImage;
        bg2.style.opacity = "0";
        bg1.style.opacity = "1";
    }, 1500);
}

// init
initBackground();
setInterval(rotateBackground, 6000);

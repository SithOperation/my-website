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
// BACKGROUND GIF ROTATION (FIXED 4 GIFS)
// =====================

const gifs = [
    "assets/i-made-some-gifs-v0-9yugvn57e5o81.gif",
    "assets/i-made-some-gifs-v0-fphci857e5o81.gif",
    "assets/i-made-some-gifs-v0-uhn1le67e5o81.gif",
    "assets/i-made-some-gifs-v0-vv91pq57e5o81.gif"
];

let current = 0;

function setBg(layer, url, opacity) {
    layer.style.backgroundImage = `url('${url}')`;
    layer.style.opacity = opacity;
}

function rotateBg() {
    const layers = [
        document.getElementById("bg1"),
        document.getElementById("bg2"),
        document.getElementById("bg3")
    ];

    if (!layers[0]) return;

    current = (current + 1) % gifs.length;

    setBg(layers[0], gifs[current], "1");
    setBg(layers[1], gifs[(current + 1) % gifs.length], "0");
    setBg(layers[2], gifs[(current + 2) % gifs.length], "0");
}

function initBg() {
    const layers = [
        document.getElementById("bg1"),
        document.getElementById("bg2"),
        document.getElementById("bg3")
    ];

    if (!layers[0]) return;

    setBg(layers[0], gifs[0], "1");
    setBg(layers[1], gifs[1], "0");
    setBg(layers[2], gifs[2], "0");
}

initBg();
setInterval(rotateBg, 6000);

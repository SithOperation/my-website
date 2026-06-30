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
// PROJECT VIEWER
// =====================

function loadProject(key) {
    const viewer = document.getElementById("viewer-content");
    if (!viewer) return;

    const project = projects[key];

    if (!project) {
        viewer.innerHTML = "<p>Project not found.</p>";
        return;
    }

    const imagesHTML = project.images?.length
        ? `
        <h3>Evidence</h3>
        <div class="grid">
            ${project.images.map(img => `
                <img src="${img}" style="
                    width:100%;
                    border-radius:8px;
                    border:1px solid rgba(255,255,255,0.1);
                ">
            `).join("")}
        </div>
        `
        : "";

    const pdfHTML = project.pdf
        ? `
        <h3 style="margin-top:20px;">Report</h3>

        <iframe
            src="${project.pdf}"
            style="width:100%; height:500px; border:none; border-radius:8px; background:white;">
        </iframe>

        <a href="${project.pdf}" target="_blank" class="project">
            Open PDF
        </a>
        `
        : "";

    viewer.innerHTML = `
        <h2>${project.title}</h2>
        ${imagesHTML}
        ${pdfHTML}
    `;

    viewer.scrollIntoView({ behavior: "smooth" });
}

// =====================
// Background images
// =====================


const gifs = [
    "assets/i-made-some-gifs-v0-9yugvn57e5o81.gif",
    "assets/i-made-some-gifs-v0-fphci857e5o81.gif",
    "assets/i-made-some-gifs-v0-uhn1le67e5o81.gif",
    "assets/i-made-some-gifs-v0-vv91pq57e5o81.gif"
];

let current = 0;

const bg1 = document.getElementById("bg1");
const bg2 = document.getElementById("bg2");
const bg3 = document.getElementById("bg3");

function setInitialBackgrounds() {
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

    current = (current + 1) % gifs.length;

    const nextGif = gifs[current];

    // rotate layers manually (no array mutation)
    if (bg1.style.opacity === "1") {
        bg2.style.backgroundImage = `url('${nextGif}')`;
        fade(bg1, bg2);
    } else if (bg2.style.opacity === "1") {
        bg3.style.backgroundImage = `url('${nextGif}')`;
        fade(bg2, bg3);
    } else {
        bg1.style.backgroundImage = `url('${nextGif}')`;
        fade(bg3, bg1);
    }
}

function fade(from, to) {
    from.style.transition = "opacity 1.5s ease-in-out";
    to.style.transition = "opacity 1.5s ease-in-out";

    to.style.opacity = "1";
    from.style.opacity = "0";
}

// init
setInitialBackgrounds();
setInterval(rotateBackground, 6000);

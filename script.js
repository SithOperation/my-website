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
        images: [
            "assets/projects/image4.jpg",
            "assets/projects/image5.jpg"
        ],
        pdf: "assets/projects/project2.pdf"
    },

    nestle: {
        title: "Nestle CIA Threat Table",
        images: [
            "assets/projects/image1.jpg"
        ],
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

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
        el.innerHTML += '<span class="cursor">█</span>';
    }
}

type();


// =====================
// PROJECT VIEWER (IMAGES + PDF)
// =====================

function loadProject(project) {
    const viewer = document.getElementById("viewer-content");
    if (!viewer) return;

    let title = "";
    let images = [];
    let pdf = "";

    // ---------------------
    // PROJECT DEFINITIONS
    // ---------------------

    if (project === "reddit") {
        title = "Reddit Threat Monitor";

        images = [
            "assets/image1.jpg",
            "assets/image2.jpg",
            "assets/image3.jpg"
        ];

        pdf = ""; // no pdf yet
    }

    else if (project === "ransomware") {
        title = "Healthcare Ransomware Defense";

        images = [
            "assets/image4.jpg",
            "assets/image5.jpg"
        ];

        pdf = "assets/projects/project2.pdf";
    }

    else if (project === "nestle") {
        title = "Nestle CIA Threat Table";

        images = [
            "assets/image1.jpg"
        ];

        pdf = "assets/projects/project1.pdf";
    }

    else {
        viewer.innerHTML = "<p>No project found.</p>";
        return;
    }

    // ---------------------
    // BUILD IMAGE SECTION
    // ---------------------

    let imageHTML = "";

    if (images.length > 0) {
        imageHTML = `
            <h3>Evidence / Screenshots</h3>
            <div style="
                display:grid;
                grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
                gap:10px;
                margin-top:10px;
            ">
                ${images.map(img => `
                    <img src="${img}" style="
                        width:100%;
                        border-radius:8px;
                        border:1px solid rgba(255,255,255,0.1);
                        cursor:pointer;
                    ">
                `).join("")}
            </div>
        `;
    }

    // ---------------------
    // BUILD PDF SECTION
    // ---------------------

    let pdfHTML = "";

    if (pdf) {
        pdfHTML = `
            <h3 style="margin-top:20px;">Full Report</h3>

            <iframe
                src="${pdf}"
                style="
                    width:100%;
                    height:500px;
                    border:none;
                    border-radius:8px;
                    background:white;
                ">
            </iframe>

            <a href="${pdf}"
               target="_blank"
               style="
                    display:inline-block;
                    margin-top:10px;
                    padding:10px 14px;
                    background:#00ffd5;
                    color:black;
                    border-radius:8px;
                    text-decoration:none;
               ">
               Open PDF in New Tab
            </a>
        `;
    }

    // ---------------------
    // RENDER EVERYTHING
    // ---------------------

    viewer.innerHTML = `
        <h2>${title}</h2>

        ${imageHTML}
        ${pdfHTML}
    `;

    viewer.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

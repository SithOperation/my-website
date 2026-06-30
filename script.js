// =====================
// TYPEWRITER EFFECT
// =====================

const text = "system online...";
let i = 0;

function type() {
    const el = document.getElementById("typing");
    if (!el) return;

    // reset only once
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
// PROJECT VIEWER SYSTEM
// =====================

function loadProject(project) {
    const viewer = document.getElementById("viewer-content");
    if (!viewer) return;

    let title = "";
    let description = "";
    let images = [];
    let pdf = "";

    // ---------------------
    // PROJECT DATA
    // ---------------------

    if (project === "reddit") {
        title = "Reddit Threat Monitor";
        description =
            "Automated threat intelligence system that monitors Reddit for cybersecurity signals and suspicious patterns.";

        images = [
            "assets/image1.jpg",
            "assets/image2.jpg"
        ];

        pdf = "assets/projects/reddit-monitor.pdf";
    }

    else if (project === "ransomware") {
        title = "Healthcare Ransomware Defense";
        description =
            "Enterprise ransomware mitigation strategy focused on healthcare security environments.";

        images = [
            "assets/image3.jpg",
            "assets/image4.jpg"
        ];

        pdf = "assets/projects/project2.pdf";
    }

    else if (project === "nestle") {
        title = "Nestle CIA Threat Table";
        description =
            "Risk assessment model based on Confidentiality, Integrity, and Availability principles.";

        images = [
            "assets/image5.jpg"
        ];

        pdf = "assets/projects/project1.pdf";
    }

    else {
        viewer.innerHTML = "<p>Project not found.</p>";
        return;
    }

    // ---------------------
    // IMAGE SECTION
    // ---------------------

    let imageHTML = "";

    if (images.length > 0) {
        imageHTML = `
            <h4>Evidence / Screenshots</h4>
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
                    ">
                `).join("")}
            </div>
        `;
    }

    // ---------------------
    // PDF SECTION (IFRAME FIX)
    // ---------------------

    let pdfHTML = "";

    if (pdf) {
        pdfHTML = `
            <h4 style="margin-top:20px;">Full Report</h4>

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
    // FINAL RENDER
    // ---------------------

    viewer.innerHTML = `
        <h3>${title}</h3>
        <p>${description}</p>

        ${imageHTML}
        ${pdfHTML}
    `;

    // smooth scroll into view
    viewer.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

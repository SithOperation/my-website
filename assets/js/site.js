(function () {
    "use strict";

    const projects = {
        reddit: {
            title: "Reddit Threat Monitor",
            images: [1, 2, 3, 4, 5].map(number => `assets/projects/reddit/image${number}.jpg`)
        },
        ransomware: {
            title: "Healthcare Ransomware Defense",
            pdf: "assets/projects/project2.pdf"
        },
        nestle: {
            title: "Nestle CIA Threat Table",
            pdf: "assets/projects/project1.pdf"
        }
    };

    const backgrounds = [
        "assets/i-made-some-gifs-v0-9yugvn57e5o81.gif",
        "assets/i-made-some-gifs-v0-fphci857e5o81.gif",
        "assets/i-made-some-gifs-v0-uhn1le67e5o81.gif",
        "assets/i-made-some-gifs-v0-vv91pq57e5o81.gif"
    ];

    function trustedHttpURL(value) {
        try {
            const url = new URL(String(value || ""), window.location.href);
            return ["http:", "https:"].includes(url.protocol) ? url.href : null;
        }
        catch {
            return null;
        }
    }

    async function fetchJSON(path) {
        const response = await fetch(path, { cache: "no-cache", headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`${path} unavailable (${response.status})`);
        return response.json();
    }

    function startTypewriter() {
        const output = document.getElementById("typing");
        if (!output) return;
        const message = "system online...";
        let index = 0;
        output.replaceChildren();

        const type = () => {
            if (index < message.length) {
                output.append(document.createTextNode(message[index]));
                index += 1;
                window.setTimeout(type, 80);
                return;
            }
            const cursor = document.createElement("span");
            cursor.className = "cursor";
            cursor.textContent = "█";
            output.appendChild(cursor);
        };
        type();
    }

    function initializeBackgrounds() {
        const layers = ["bg1", "bg2", "bg3"].map(id => document.getElementById(id));
        if (layers.some(layer => !layer)) return;
        backgrounds.forEach(source => { const image = new Image(); image.src = source; });
        layers.forEach((layer, index) => { layer.style.backgroundImage = `url("${backgrounds[index]}")`; });
        layers[0].style.opacity = "1";
        let current = 0;

        window.setInterval(() => {
            current = (current + 1) % backgrounds.length;
            layers[2].style.backgroundImage = `url("${backgrounds[current]}")`;
            layers[2].style.opacity = "1";
            window.setTimeout(() => {
                layers[0].style.backgroundImage = layers[2].style.backgroundImage;
                layers[2].style.opacity = "0";
            }, 1500);
        }, 6000);
    }

    function loadProject(key) {
        const project = projects[key];
        const viewer = document.getElementById("viewer-content");
        if (!project || !viewer) return;

        const heading = document.createElement("h2");
        heading.textContent = project.title;
        const content = [heading];

        if (project.images?.length) {
            const evidenceHeading = document.createElement("h3");
            evidenceHeading.textContent = "Evidence";
            content.push(evidenceHeading);
            project.images.forEach((source, index) => {
                const image = document.createElement("img");
                image.src = source;
                image.alt = `${project.title} evidence ${index + 1}`;
                image.loading = "lazy";
                content.push(image);
            });
        }

        if (project.pdf) {
            const reportHeading = document.createElement("h3");
            const frame = document.createElement("iframe");
            const link = document.createElement("a");
            reportHeading.textContent = "Report";
            frame.src = project.pdf;
            frame.title = `${project.title} report`;
            link.href = project.pdf;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "project-link";
            link.textContent = "Open Full PDF →";
            content.push(reportHeading, frame, link);
        }

        viewer.replaceChildren(...content);
        viewer.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function initializeProjects() {
        document.querySelectorAll("[data-project]").forEach(card => {
            card.addEventListener("click", () => loadProject(card.dataset.project));
        });
    }

    function storyElement(story, index) {
        const article = document.createElement("article");
        const heading = document.createElement("h3");
        const source = document.createElement("p");
        const summary = document.createElement("p");
        const score = document.createElement("p");
        article.className = "intel-item";
        heading.textContent = `${index + 1}. ${story.title || "Untitled report"}`;
        source.textContent = `Source: ${story.source || "Unknown"}`;
        summary.textContent = story.summary || "No summary available.";
        score.textContent = `Score: ${story.score ?? "Unknown"}`;
        article.append(heading, source, summary, score);

        const href = trustedHttpURL(story.link);
        if (href) {
            const link = document.createElement("a");
            link.href = href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "project-link";
            link.textContent = "Read Report →";
            article.appendChild(link);
        }
        return article;
    }

    async function loadCyberNews() {
        const feed = document.getElementById("ai-news-feed");
        if (!feed) return;
        try {
            const data = await fetchJSON("data/ai_cyber_digest.json");
            const status = document.createElement("div");
            status.className = "intel-status";
            status.textContent = "● AI CYBER DIGEST ONLINE";
            const stories = Array.isArray(data.stories) ? data.stories.slice(0, 5) : [];
            const content = stories.length ? stories.map(storyElement) : [Object.assign(document.createElement("div"), { className: "intel-item", textContent: "No reports available." })];
            feed.replaceChildren(status, ...content);
        }
        catch (error) {
            console.error("AI cyber digest failed", error);
            const status = document.createElement("div");
            status.className = "status-alert";
            status.textContent = "● AI INTELLIGENCE OFFLINE";
            feed.replaceChildren(status);
        }
    }

    function initializeReturnToTop() {
        const button = document.getElementById("ufo-top");
        if (!button) return;
        button.addEventListener("click", () => {
            button.classList.add("launch");
            window.scrollTo({ top: 0, behavior: "smooth" });
            window.setTimeout(() => button.classList.remove("launch"), 1000);
        });
    }

    function initializeNavigationSelection() {
        const links = [...document.querySelectorAll('nav a[href^="#"]')];
        const sections = links.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
        if (!links.length || !sections.length) return;

        const select = id => links.forEach(link => {
            const selected = link.getAttribute("href") === `#${id}`;
            link.classList.toggle("is-current", selected);
            if (selected) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
        });

        select(sections[0].id);
        const observer = new IntersectionObserver(entries => {
            const visible = entries.filter(entry => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (visible) select(visible.target.id);
        }, { rootMargin: "-18% 0px -62%", threshold: [0, .15, .4] });

        sections.forEach(section => observer.observe(section));
        links.forEach(link => link.addEventListener("click", () => select(link.getAttribute("href").slice(1))));
    }

    document.addEventListener("DOMContentLoaded", () => {
        startTypewriter();
        initializeBackgrounds();
        initializeProjects();
        initializeReturnToTop();
        initializeNavigationSelection();
        loadCyberNews();
    });
}());

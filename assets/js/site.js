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
        },
        "ai-optimization": {
            title: "AI Optimization Tool",
            subtitle: "Proprietary AI Analytics & Cost Optimization Platform",
            badge: "PRIVATE / PROPRIETARY · ACTIVE DEVELOPMENT",
            summary: "The AI Optimization Tool is a desktop analytics platform built to help organizations understand and reduce the operational cost of using AI models. The project focuses on a growing problem with AI adoption: companies can track how much they are spending, but it is often much harder to determine where that spending is being wasted or what changes could actually improve efficiency.",
            sections: [
                {
                    title: "Overview",
                    body: "The platform collects local AI usage telemetry and turns that information into a clearer picture of token consumption, model usage, estimated costs, historical trends, and potential optimization opportunities. Instead of only displaying raw usage numbers, the system is designed to help identify patterns and provide actionable information about where AI workloads may be optimized."
                },
                {
                    title: "What It Does",
                    body: "The platform provides visibility into AI usage through a centralized desktop dashboard. It can analyze historical activity, track token and cost trends, compare optimization scenarios, and forecast future usage based on collected telemetry."
                },
                {
                    title: "How It Was Built",
                    body: "The application combines a desktop interface with a local backend responsible for telemetry processing, analytics, forecasting, and data management. A major design goal was keeping the system local-first where practical. This provides greater control over collected telemetry while reducing the need to send sensitive usage information to additional third-party services."
                },
                {
                    title: "Why I Built It",
                    body: "As AI becomes integrated into more business processes, efficiency becomes just as important as capability. A model or workflow can perform well while still consuming significantly more resources than necessary. This project explores how to make AI usage measurable enough to identify where resources are being consumed and where meaningful optimization may be possible. The result is an evolving platform that combines telemetry, analytics, forecasting, and optimization in a single environment."
                }
            ],
            capabilities: [
                "AI token and usage telemetry", "Cost and consumption analysis",
                "Historical usage tracking", "Cost and usage forecasting",
                "Optimization scenario modeling", "Potential efficiency opportunities",
                "Local telemetry and backend health monitoring",
                "Import and historical data analysis", "Interactive analytics and visualization"
            ],
            technologies: [
                "Python", "Rust", "Tauri", "REST APIs", "SQLite", "JSON",
                "Local telemetry", "Data visualization", "Forecasting", "AI cost analysis"
            ],
            architecture: [
                "AI Applications", "Local Telemetry", "Optimization Backend",
                "Analytics / Forecasting", "Desktop Dashboard"
            ],
            images: [
                { source: "assets/projects/ai-optimization-tool/pricing-registry.png", alt: "AI Optimization Tool pricing registry showing demo model cost configuration" },
                { source: "assets/projects/ai-optimization-tool/model-intelligence.png", alt: "AI Optimization Tool model intelligence dashboard comparing demo model usage and costs" },
                { source: "assets/projects/ai-optimization-tool/optimization-insights.png", alt: "AI Optimization Tool optimization view showing demo savings opportunities and recommendations" }
            ],
            ownership: "This software is being privately developed by my business partner and me. The public portfolio demonstrates the project's capabilities and user interface, while the source code, executable distributions, internal optimization methods, and certain architectural details remain private. The screenshots use demonstration data and provide an overview of the platform without exposing proprietary implementation details."
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
        // Load only the visible animation. Subsequent backgrounds are fetched
        // when their rotation begins instead of transferring all ~55 MiB at
        // initial page load.
        layers.forEach(layer => {
            layer.style.backgroundImage = `url("${backgrounds[0]}")`;
        });
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
        viewer.classList.toggle("case-study", Boolean(project.summary));

        const heading = document.createElement("h2");
        heading.textContent = project.title;
        const content = [heading];

        if (project.subtitle) {
            const subtitle = document.createElement("p");
            subtitle.className = "case-study-subtitle";
            subtitle.textContent = project.subtitle;
            content.push(subtitle);
        }

        if (project.badge) {
            const badge = document.createElement("p");
            badge.className = "case-study-badge";
            badge.textContent = project.badge;
            content.push(badge);
        }

        if (project.summary) {
            const summary = document.createElement("p");
            summary.className = "case-study-summary";
            summary.textContent = project.summary;
            content.push(summary);
        }

        project.sections?.forEach(section => {
            const sectionElement = document.createElement("section");
            const sectionHeading = document.createElement("h3");
            const sectionBody = document.createElement("p");
            sectionElement.className = "case-study-section";
            sectionHeading.textContent = section.title;
            sectionBody.textContent = section.body;
            sectionElement.append(sectionHeading, sectionBody);
            content.push(sectionElement);
        });

        [["Key Capabilities", project.capabilities], ["Technologies", project.technologies]].forEach(([title, items]) => {
            if (!items?.length) return;
            const section = document.createElement("section");
            const sectionHeading = document.createElement("h3");
            const list = document.createElement("ul");
            section.className = "case-study-section";
            list.className = "case-study-tags";
            sectionHeading.textContent = title;
            items.forEach(item => {
                const listItem = document.createElement("li");
                listItem.textContent = item;
                list.appendChild(listItem);
            });
            section.append(sectionHeading, list);
            content.push(section);
        });

        if (project.architecture?.length) {
            const section = document.createElement("section");
            const sectionHeading = document.createElement("h3");
            const flow = document.createElement("ol");
            section.className = "case-study-section";
            flow.className = "case-study-flow";
            sectionHeading.textContent = "High-Level Architecture";
            project.architecture.forEach(item => {
                const step = document.createElement("li");
                step.textContent = item;
                flow.appendChild(step);
            });
            section.append(sectionHeading, flow);
            content.push(section);
        }

        if (project.images?.length) {
            const evidenceHeading = document.createElement("h3");
            evidenceHeading.textContent = project.summary ? "Product Screenshots" : "Evidence";
            content.push(evidenceHeading);
            project.images.forEach((entry, index) => {
                const image = document.createElement("img");
                image.src = typeof entry === "string" ? entry : entry.source;
                image.alt = typeof entry === "string" ? `${project.title} evidence ${index + 1}` : entry.alt;
                image.loading = "lazy";
                image.decoding = "async";
                content.push(image);
            });
        }

        if (project.ownership) {
            const notice = document.createElement("aside");
            const noticeHeading = document.createElement("h3");
            const noticeBody = document.createElement("p");
            const contactLink = document.createElement("a");
            notice.className = "case-study-notice";
            noticeHeading.textContent = "Privacy / Ownership";
            noticeBody.textContent = project.ownership;
            contactLink.href = "#contact";
            contactLink.className = "project-link";
            contactLink.textContent = "Interested in the technology? Contact me →";
            notice.append(noticeHeading, noticeBody, contactLink);
            content.push(notice);
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
        const metadata = document.createElement("p");
        article.className = "intel-item";
        heading.textContent = `${index + 1}. ${story.title || "Untitled report"}`;
        source.textContent = `Source: ${story.source || "Unknown"}`;
        summary.textContent = story.summary || "No summary available.";
        const score = story.importance_score ?? story.score;
        metadata.textContent = [
            story.severity,
            story.category,
            score === undefined || score === null ? null : `Score ${score}/100`
        ].filter(Boolean).join(" · ");
        article.append(heading, source, summary);
        if (metadata.textContent) article.append(metadata);

        const href = trustedHttpURL(story.source_url || story.link);
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
            const generated = new Date(data.generated_at || data.generated || "");
            const freshness = Number.isNaN(generated.getTime()) ? "" : ` · Updated ${generated.toLocaleString()}`;
            status.textContent = `● AI CYBER DIGEST ONLINE${freshness}`;
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

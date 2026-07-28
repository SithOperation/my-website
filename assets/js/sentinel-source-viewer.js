(function () {
    "use strict";

    const VALID_HEALTH = new Set(["fresh", "stale", "partial", "unavailable"]);
    const SUPPORTED_SCHEMA_MAJOR = 1;

    function schemaMajor(value) {
        const match = String(value || "").match(/^(\d+)/);
        return match ? Number(match[1]) : null;
    }

    function safeSourceUrl(value) {
        try {
            const url = new URL(String(value || ""));
            return url.protocol === "https:" ? url.href : "";
        }
        catch {
            return "";
        }
    }

    function cleanText(value, fallback = "") {
        const text = String(value || "").replace(/\s+/g, " ").trim();
        return text || fallback;
    }

    function confidenceLabel(value) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0 || number > 1) return "";
        return `${Math.round(number * 100)}%`;
    }

    function displayLabel(value) {
        return cleanText(value, "unknown")
            .replace(/_/g, " ")
            .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function normalizeItem(item) {
        if (!item || typeof item !== "object") return null;
        const sourceUrl = safeSourceUrl(item.source_url);
        if (!sourceUrl || item.feed_eligible !== true) return null;
        const publishedTimestamp = Date.parse(String(item.published_at || ""));
        if (!Number.isFinite(publishedTimestamp)) return null;
        return {
            id: cleanText(item.id),
            platform: displayLabel(item.platform),
            sourceName: cleanText(item.source_name, cleanText(item.source_handle, "Unknown source")),
            sourceHandle: cleanText(item.source_handle),
            sourceUrl,
            publishedAt: new Date(publishedTimestamp).toISOString(),
            title: cleanText(item.title),
            text: cleanText(item.text, "No report summary is available."),
            locationLabel: cleanText(item.location_label, "Location not provided"),
            locationStatus: displayLabel(item.location_status || "missing"),
            locationConfidence: confidenceLabel(item.location_confidence),
            claimStatus: displayLabel(item.claim_status || "unverified"),
            claimConfidence: confidenceLabel(item.claim_confidence)
        };
    }

    function classifyFeed(feed) {
        if (!feed || typeof feed !== "object" || !Array.isArray(feed.items)) return "invalid";
        const health = String(feed.health?.status || "").toLowerCase();
        if (!VALID_HEALTH.has(health)) return "invalid";
        if (health === "unavailable") return "unavailable";
        if (feed.items.length === 0) return "empty";
        return health === "fresh" ? "available" : health;
    }

    function stateMessage(state, count = 0) {
        const messages = {
            loading: "Loading source reports…",
            available: `${count} current source report${count === 1 ? "" : "s"}.`,
            partial: `${count} source report${count === 1 ? "" : "s"} available. Some sources are temporarily unavailable.`,
            stale: `${count} retained source report${count === 1 ? "" : "s"}. Updates are delayed.`,
            empty: "No current source reports are available.",
            unavailable: "Source discovery is temporarily unavailable. The verified map remains operational.",
            invalid: "The source feed failed integrity checks and was not displayed."
        };
        return messages[state] || messages.invalid;
    }

    class SourceFeedClient {
        constructor(root = "data") {
            this.root = root;
        }

        async fetchJSON(filename, publicationId = "") {
            const version = publicationId ? `?publication=${encodeURIComponent(publicationId)}` : "";
            const response = await fetch(`${this.root}/${filename}${version}`, {
                cache: "no-store",
                headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error(`${filename} unavailable (${response.status})`);
            return response.json();
        }

        async load() {
            const manifest = await this.fetchJSON("manifest.json");
            if (!manifest?.publication_id || schemaMajor(manifest.schema_version) !== SUPPORTED_SCHEMA_MAJOR) {
                throw new Error("Invalid Sentinel manifest");
            }
            const publicationId = String(manifest.publication_id);
            const feed = await this.fetchJSON("source_feed.json", publicationId);
            const confirmation = await this.fetchJSON("manifest.json");
            if (
                feed?.publication_id !== publicationId ||
                confirmation?.publication_id !== publicationId ||
                schemaMajor(feed?.schema_version) !== SUPPORTED_SCHEMA_MAJOR ||
                feed?.count !== feed?.items?.length
            ) {
                throw new Error("Mixed or invalid Sentinel source publication");
            }
            return {
                feed,
                state: classifyFeed(feed),
                items: feed.items.map(normalizeItem).filter(Boolean)
                    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
            };
        }
    }

    function createField(label, value) {
        const wrapper = document.createElement("div");
        wrapper.className = "source-field";
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value;
        wrapper.append(term, description);
        return wrapper;
    }

    function buildCard(item) {
        const article = document.createElement("article");
        article.className = "source-card";
        const kicker = document.createElement("p");
        kicker.className = "source-card-kicker";
        kicker.textContent = [item.platform, item.sourceName, item.sourceHandle].filter(Boolean).join(" · ");
        const heading = document.createElement("h3");
        heading.textContent = item.title || item.text.slice(0, 90);
        const timestamp = document.createElement("time");
        timestamp.dateTime = item.publishedAt;
        timestamp.textContent = new Date(item.publishedAt).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short"
        });
        const text = document.createElement("p");
        text.className = "source-card-text";
        text.textContent = item.text;
        const metadata = document.createElement("dl");
        metadata.className = "source-card-metadata";
        metadata.append(
            createField("Location", item.locationLabel),
            createField("Location status", `${item.locationStatus}${item.locationConfidence ? ` · ${item.locationConfidence}` : ""}`),
            createField("Claim status", `${item.claimStatus}${item.claimConfidence ? ` · ${item.claimConfidence}` : ""}`)
        );
        const link = document.createElement("a");
        link.className = "source-original-link";
        link.href = item.sourceUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open original source";
        article.append(kicker, heading, timestamp, text, metadata, link);
        return article;
    }

    class SourceViewer {
        constructor(client = new SourceFeedClient()) {
            this.client = client;
            this.items = [];
            this.index = 0;
            this.state = "loading";
            this.returnFocus = null;
            this.loaded = false;
        }

        elements() {
            return {
                viewer: document.getElementById("source-viewer"),
                backdrop: document.getElementById("source-viewer-backdrop"),
                open: document.getElementById("source-viewer-open"),
                close: document.getElementById("source-viewer-close"),
                content: document.getElementById("source-viewer-content"),
                status: document.getElementById("source-viewer-status"),
                count: document.getElementById("source-feed-count"),
                nav: document.getElementById("source-viewer-nav"),
                previous: document.getElementById("source-viewer-previous"),
                next: document.getElementById("source-viewer-next"),
                position: document.getElementById("source-viewer-position")
            };
        }

        render() {
            const elements = this.elements();
            elements.viewer.dataset.feedState = this.state;
            elements.status.textContent = stateMessage(this.state, this.items.length);
            elements.count.textContent = this.items.length ? String(this.items.length) : "0";
            elements.content.replaceChildren();
            if (this.items.length) {
                elements.content.append(buildCard(this.items[this.index]));
                elements.nav.hidden = false;
                elements.position.textContent = `${this.index + 1} of ${this.items.length}`;
                elements.previous.disabled = this.index === 0;
                elements.next.disabled = this.index === this.items.length - 1;
            }
            else {
                const empty = document.createElement("div");
                empty.className = "source-feed-empty";
                const heading = document.createElement("h3");
                heading.textContent = this.state === "invalid" ? "Feed withheld" : "No source cards";
                const detail = document.createElement("p");
                detail.textContent = stateMessage(this.state);
                empty.append(heading, detail);
                elements.content.append(empty);
                elements.nav.hidden = true;
            }
        }

        async load() {
            this.state = "loading";
            this.render();
            try {
                const result = await this.client.load();
                this.items = result.items;
                this.state = result.items.length === result.feed.items.length ? result.state : "invalid";
                if (this.items.length === 0 && ["available", "partial", "stale"].includes(this.state)) {
                    this.state = "empty";
                }
            }
            catch (error) {
                console.error("Sentinel source feed rejected", error);
                this.items = [];
                this.state = "invalid";
            }
            this.loaded = true;
            this.render();
        }

        open() {
            const elements = this.elements();
            this.returnFocus = document.activeElement;
            elements.viewer.hidden = false;
            elements.backdrop.hidden = false;
            elements.viewer.setAttribute("aria-modal", window.matchMedia("(max-width: 820px)").matches ? "true" : "false");
            elements.open.setAttribute("aria-expanded", "true");
            document.body.classList.add("source-viewer-active");
            elements.close.focus();
            if (!this.loaded) this.load();
        }

        close() {
            const elements = this.elements();
            elements.viewer.hidden = true;
            elements.backdrop.hidden = true;
            elements.open.setAttribute("aria-expanded", "false");
            document.body.classList.remove("source-viewer-active");
            if (this.returnFocus?.focus) this.returnFocus.focus();
        }

        move(offset) {
            this.index = Math.max(0, Math.min(this.items.length - 1, this.index + offset));
            this.render();
        }

        bind() {
            const elements = this.elements();
            if (!elements.viewer || !elements.open) return;
            elements.open.addEventListener("click", () => this.open());
            elements.close.addEventListener("click", () => this.close());
            elements.backdrop.addEventListener("click", () => this.close());
            elements.previous.addEventListener("click", () => this.move(-1));
            elements.next.addEventListener("click", () => this.move(1));
            document.addEventListener("keydown", event => {
                if (elements.viewer.hidden) return;
                if (event.key === "Escape") {
                    event.preventDefault();
                    this.close();
                }
                else if (event.key === "ArrowLeft") this.move(-1);
                else if (event.key === "ArrowRight") this.move(1);
                else if (event.key === "Tab") {
                    const focusable = Array.from(elements.viewer.querySelectorAll("button:not([disabled]), a[href]"));
                    if (!focusable.length) return;
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last.focus();
                    }
                    else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first.focus();
                    }
                }
            });
            this.load();
        }
    }

    window.SentinelSourceViewer = Object.freeze({
        SourceFeedClient,
        SourceViewer,
        normalizeItem,
        classifyFeed,
        stateMessage,
        safeSourceUrl,
        buildCard
    });

    document.addEventListener("DOMContentLoaded", () => new SourceViewer().bind());
}());

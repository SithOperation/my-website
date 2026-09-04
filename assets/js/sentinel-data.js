(function () {
    "use strict";

    const SUPPORTED_SCHEMA_MAJOR = 1;
    const MAP_RETENTION_MS = 48 * 60 * 60 * 1000;
    const REQUEST_TIMEOUT_MS = 12_000;

    function schemaMajor(value) {
        const match = String(value || "").match(/^(\d+)/);
        return match ? Number(match[1]) : null;
    }

    function validCoordinate(value, limit) {
        const number = Number(value);
        return Number.isFinite(number) && Math.abs(number) <= limit;
    }

    function isWithinRetentionWindow(value, now = Date.now()) {
        const timestamp = Date.parse(String(value || ""));
        return Number.isFinite(timestamp) && timestamp >= now - MAP_RETENTION_MS;
    }

    function cleanText(value, maximumLength = 700) {
        const raw = String(value || "");
        if (!raw) return "";

        const documentNode = new DOMParser().parseFromString(raw, "text/html");
        documentNode.querySelectorAll("script, style, svg, nav, aside, header, footer, form").forEach(node => node.remove());

        const paragraphs = Array.from(documentNode.querySelectorAll("p"))
            .map(node => (node.textContent || "").replace(/\s+/g, " ").trim())
            .filter(text => text.length >= 45);
        let text = paragraphs[0] || (documentNode.body.textContent || raw);
        text = text.replace(/\s+/g, " ").trim();

        if (text.length > maximumLength) {
            const shortened = text.slice(0, maximumLength - 1);
            const wordBoundary = shortened.lastIndexOf(" ");
            text = `${shortened.slice(0, Math.max(wordBoundary, maximumLength * 0.75))}…`;
        }

        return text;
    }

    function normalizeEvent(event) {
        if (!event || typeof event !== "object") return null;

        const latitude = event.latitude ?? event.location?.latitude ?? event.coordinates?.lat;
        const longitude = event.longitude ?? event.location?.longitude ?? event.coordinates?.lon;
        if (!validCoordinate(latitude, 90) || !validCoordinate(longitude, 180)) return null;

        const title = cleanText(event.title || "Untitled intelligence event", 180);
        const description = cleanText(event.description || "No summary is available.", 700);
        const sourceType = String(event.type || event.event_type || event.category || "unknown").toLowerCase();
        const classificationText = `${title} ${description}`.toLowerCase();
        let type = sourceType;
        if (/\b(prescribed|controlled|planned)\s+(fire|burn)\b|\bprescribed fire rx\b/.test(classificationText)) type = "prescribed_fire";
        else if (/\b(wildfire|wild fire|bushfire)\b/.test(classificationText)) type = "wildfire";
        else if (/\b(military|training|live[- ]fire)\s+exercise\b/.test(classificationText)) type = "military_exercise";

        return {
            ...event,
            event_id: String(event.event_id || event.id || ""),
            title,
            description,
            latitude: Number(latitude),
            longitude: Number(longitude),
            type,
            source_type: sourceType,
            threat_level: String(event.threat_level || event.priority || "unknown").toUpperCase(),
            confidence: Number.isFinite(Number(event.confidence)) ? Number(event.confidence) : null,
            timestamp: event.timestamp ? String(event.timestamp) : null
        };
    }

    function sourceEntries(health) {
        if (!health || typeof health !== "object") return [];
        if (Array.isArray(health.sources)) return health.sources;
        if (health.sources && typeof health.sources === "object") {
            return Object.entries(health.sources).map(([name, details]) => ({ name, ...(details || {}) }));
        }
        return [];
    }

    function healthState(health, generated) {
        if (!health) {
            return {
                state: "degraded",
                generated,
                failedSources: [],
                message: "Source health metadata is unavailable."
            };
        }

        const sources = sourceEntries(health);
        const healthyStatuses = new Set(["ok", "healthy", "fresh", "success", "disabled"]);
        const failedSources = sources.filter(source => {
            const status = String(source.status || "").toLowerCase();
            return status && !healthyStatuses.has(status);
        });
        const declared = String(health.status || health.overall_status || "").toLowerCase();
        const degraded = Boolean(health.degraded) || Boolean(health.stale) || failedSources.length > 0 ||
            ["degraded", "stale", "partial", "failed"].includes(declared);

        return {
            state: degraded ? "degraded" : "fresh",
            generated: health.generated || health.checked_at || generated,
            failedSources,
            message: degraded ? "Sentinel coverage is degraded." : "Sentinel coverage is operational."
        };
    }

    class Client {
        constructor(options = {}) {
            this.root = options.root || "data";
            this.activePublicationId = null;
            this.snapshot = null;
        }

        async fetchJSON(filename, publicationId = null, noStore = false) {
            const version = publicationId ? `?publication=${encodeURIComponent(publicationId)}` : "";
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            try {
                const response = await fetch(`${this.root}/${filename}${version}`, {
                    cache: noStore ? "no-store" : "default",
                    headers: { Accept: "application/json" },
                    signal: controller.signal
                });
                if (!response.ok) throw new Error(`${filename} unavailable (${response.status})`);
                return await response.json();
            }
            catch (error) {
                if (error?.name === "AbortError") {
                    throw new Error(`${filename} request timed out`);
                }
                throw error;
            }
            finally {
                window.clearTimeout(timeout);
            }
        }

        validateManifest(manifest) {
            if (!manifest || typeof manifest !== "object" || !manifest.publication_id) {
                const error = new Error("The Sentinel manifest is incomplete.");
                error.code = "INVALID_MANIFEST";
                throw error;
            }
            if (schemaMajor(manifest.schema_version) !== SUPPORTED_SCHEMA_MAJOR) {
                const error = new Error(`Unsupported Sentinel schema: ${manifest.schema_version || "unknown"}`);
                error.code = "UNSUPPORTED_SCHEMA";
                throw error;
            }
        }

        async load(options = {}) {
            const force = Boolean(options.force);
            let manifest = null;
            let legacy = false;

            try {
                manifest = await this.fetchJSON("manifest.json", null, true);
                this.validateManifest(manifest);
            }
            catch (error) {
                if (["INVALID_MANIFEST", "UNSUPPORTED_SCHEMA"].includes(error.code)) throw error;
                if (this.snapshot && !force) return { ...this.snapshot, unchanged: true, manifestUnavailable: true };
                legacy = true;
            }

            if (!legacy && !force && manifest.publication_id === this.activePublicationId && this.snapshot) {
                return { ...this.snapshot, unchanged: true };
            }

            const publicationId = legacy ? null : manifest.publication_id;
            const [dashboard, mapEvents, healthResult] = await Promise.all([
                this.fetchJSON("dashboard.json", publicationId),
                this.fetchJSON("map_events.json", publicationId),
                this.fetchJSON("health.json", publicationId).catch(error => ({ __error: error }))
            ]);

            if (!dashboard || typeof dashboard !== "object") throw new Error("Invalid dashboard data.");
            if (!Array.isArray(mapEvents)) throw new Error("Invalid map event data.");

            const events = mapEvents.map(normalizeEvent).filter(Boolean);
            const generated = manifest?.generated || dashboard.generated || null;
            const effectiveManifest = manifest || {
                publication_id: `legacy-${generated || "current"}`,
                schema_version: null,
                generated
            };
            const health = healthResult?.__error ? null : healthResult;

            this.activePublicationId = effectiveManifest.publication_id;
            this.snapshot = {
                manifest: effectiveManifest,
                dashboard,
                events,
                health,
                healthState: healthState(health, generated),
                legacy,
                unchanged: false
            };
            return this.snapshot;
        }
    }

    class GenerationFeed {
        constructor(client, options) {
            this.client = client;
            this.metadataFile = options.metadataFile;
            this.dataFile = options.dataFile;
            this.generationId = null;
            this.snapshot = null;
        }

        async load() {
            const metadata = await this.client.fetchJSON(this.metadataFile, null, true);
            const generationId = metadata?.generation_id;
            if (typeof generationId !== "string" || !generationId) {
                throw new Error(`${this.metadataFile} is missing generation_id`);
            }
            if (generationId === this.generationId && this.snapshot) {
                return { generationId, data: this.snapshot, unchanged: true };
            }

            let data = await this.client.fetchJSON(this.dataFile, generationId);
            if (data?.generation_id !== generationId) {
                data = await this.client.fetchJSON(this.dataFile, generationId, true);
            }
            if (
                !data ||
                data.type !== "FeatureCollection" ||
                !Array.isArray(data.features) ||
                data.generation_id !== generationId
            ) {
                throw new Error(`${this.dataFile} does not match generation ${generationId}`);
            }
            this.generationId = generationId;
            this.snapshot = data;
            return { generationId, data, unchanged: false };
        }
    }

    window.SentinelData = Object.freeze({
        Client,
        GenerationFeed,
        normalizeEvent,
        cleanText,
        validCoordinate,
        isWithinRetentionWindow,
        mapRetentionHours: 48,
        supportedSchemaMajor: SUPPORTED_SCHEMA_MAJOR
    });
}());

(function () {
    "use strict";

    const SUPPORTED_SCHEMA_MAJOR = 1;

    function schemaMajor(value) {
        const match = String(value || "").match(/^(\d+)/);
        return match ? Number(match[1]) : null;
    }

    function validCoordinate(value, limit) {
        const number = Number(value);
        return Number.isFinite(number) && Math.abs(number) <= limit;
    }

    function normalizeEvent(event) {
        if (!event || typeof event !== "object") return null;

        const latitude = event.latitude ?? event.location?.latitude ?? event.coordinates?.lat;
        const longitude = event.longitude ?? event.location?.longitude ?? event.coordinates?.lon;
        if (!validCoordinate(latitude, 90) || !validCoordinate(longitude, 180)) return null;

        return {
            ...event,
            event_id: String(event.event_id || event.id || ""),
            title: String(event.title || "Untitled intelligence event"),
            description: String(event.description || "No summary is available."),
            latitude: Number(latitude),
            longitude: Number(longitude),
            type: String(event.type || event.event_type || event.category || "unknown").toLowerCase(),
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
        const degraded = Boolean(health.degraded) || failedSources.length > 0 ||
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
            const response = await fetch(`${this.root}/${filename}${version}`, {
                cache: noStore ? "no-store" : "default",
                headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error(`${filename} unavailable (${response.status})`);
            return response.json();
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

    window.SentinelData = Object.freeze({
        Client,
        normalizeEvent,
        validCoordinate,
        supportedSchemaMajor: SUPPORTED_SCHEMA_MAJOR
    });
}());

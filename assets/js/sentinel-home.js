(function () {
    "use strict";

    const client = new window.SentinelData.Client({ root: "data" });
    const element = id => document.getElementById(id);

    function formatDate(value) {
        if (!value) return "unknown time";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }

    function setStatus(message, state) {
        const status = element("sentinel-publication-status");
        if (!status) return;
        status.textContent = message;
        status.className = `sentinel-status sentinel-status-${state}`;
    }

    function applySnapshot(snapshot) {
        const summary = snapshot.dashboard.summary || {};
        const critical = Array.isArray(snapshot.dashboard.critical_events) ? snapshot.dashboard.critical_events.length : 0;
        const generated = snapshot.manifest.generated || snapshot.dashboard.generated;

        element("threat-level").textContent = String(summary.global_threat_level || summary.threat_level || "UNKNOWN");
        element("total-events").textContent = Number(summary.total_events || snapshot.events.length).toLocaleString();
        element("critical-events").textContent = critical.toLocaleString();
        element("sentinel-map-summary").textContent = `${snapshot.events.length.toLocaleString()} mapped events · Updated ${formatDate(generated)}`;

        if (snapshot.legacy) {
            setStatus("Map operational with legacy publication metadata. Health manifest pending.", "degraded");
        }
        else {
            setStatus(snapshot.healthState.message, snapshot.healthState.state);
        }
    }

    async function refresh() {
        try {
            const snapshot = await client.load();
            if (!snapshot.unchanged) applySnapshot(snapshot);
            else if (snapshot.manifestUnavailable) {
                setStatus("Publication check unavailable. Last valid summary retained.", "degraded");
            }
        }
        catch (error) {
            console.error("Sentinel homepage summary failed", error);
            setStatus("Sentinel summary is temporarily unavailable. The map page remains accessible.", "error");
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        refresh();
        window.setInterval(() => {
            if (document.visibilityState === "visible") refresh();
        }, 5 * 60 * 1000);
    });
}());

(function () {
    "use strict";

    const $ = (selector) => document.querySelector(selector);
    const state = { viewer: null, events: [], visible: [], entities: new Map() };

    function setStatus(text, error = false) {
        const node = $("#cesium-status");
        node.textContent = text;
        node.classList.toggle("is-error", error);
    }

    function signalColor(event) {
        const type = `${event.type || ""} ${event.category || ""}`.toLowerCase();
        if (/earthquake|volcan|wildfire|flood|weather|cyclone|disaster/.test(type)) return Cesium.Color.MEDIUMPURPLE;
        if (/war|military|missile|conflict|security/.test(type)) return Cesium.Color.CRIMSON;
        return Cesium.Color.LIME;
    }

    function label(event) {
        return `${event.title || "Untitled event"} · ${event.type || event.category || "signal"}`;
    }

    function updateFilters() {
        const categories = [...new Set(state.events.map(event => String(event.type || event.category || "signal")))].sort();
        const severities = [...new Set(state.events.map(event => String(event.threat_level || "UNKNOWN")))].sort();
        for (const [selector, values] of [["#cesium-category", categories], ["#cesium-severity", severities]]) {
            const node = $(selector);
            node.replaceChildren(new Option("All", "all"), ...values.map(value => new Option(value, value)));
        }
    }

    function filteredEvents() {
        const category = $("#cesium-category").value;
        const severity = $("#cesium-severity").value;
        return state.events.filter(event =>
            (category === "all" || String(event.type || event.category || "signal") === category) &&
            (severity === "all" || String(event.threat_level || "UNKNOWN") === severity)
        );
    }

    function openEvent(event) {
        if (!event || !state.viewer) return;
        const popup = $("#cesium-popup");
        popup.innerHTML = `<h2>${Cesium.escapeHtml ? Cesium.escapeHtml(event.title) : String(event.title).replace(/[&<>]/g, "")}</h2>` +
            `<p><strong>Category:</strong> ${String(event.type || event.category || "signal")}</p>` +
            `<p><strong>Severity:</strong> ${String(event.threat_level || "unknown")}</p>` +
            `<p><strong>Location:</strong> ${event.latitude.toFixed(3)}, ${event.longitude.toFixed(3)}</p>` +
            `<p><strong>Time:</strong> ${event.timestamp || "Unknown"}</p>` +
            `<p><strong>Source:</strong> ${String(event.source || event.source_type || "Sentinel publication")}</p>`;
        popup.classList.add("is-open");
        state.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(event.longitude, event.latitude, 2500000), duration: .7 });
    }

    function renderFeed() {
        state.visible = filteredEvents();
        const feed = $("#cesium-feed");
        if (!state.visible.length) { feed.innerHTML = '<div class="cesium-empty">No signals match these filters.</div>'; return; }
        feed.replaceChildren(...state.visible.slice(0, 100).map(event => {
            const button = document.createElement("button");
            button.type = "button";
            button.innerHTML = `${event.title || "Untitled event"}<small>${label(event)}</small>`;
            button.addEventListener("click", () => openEvent(event));
            return button;
        }));
    }

    function plotEvents(events) {
        const source = state.viewer.entities;
        source.removeAll();
        state.entities.clear();
        for (const event of events) {
            const entity = source.add({
                id: `sentinel-${event.event_id}`,
                position: Cesium.Cartesian3.fromDegrees(event.longitude, event.latitude),
                point: { pixelSize: 9, color: signalColor(event), outlineColor: Cesium.Color.WHITE.withAlpha(.8), outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY },
                properties: { sentinelEventId: event.event_id }
            });
            state.entities.set(entity.id, event);
        }
    }

    function setupViewer() {
        state.viewer = new Cesium.Viewer("cesium-map", {
            animation: false, baseLayerPicker: false, fullscreenButton: false, geocoder: false,
            homeButton: true, infoBox: false, navigationHelpButton: false, sceneModePicker: false,
            selectionIndicator: false, timeline: false, sceneMode: Cesium.SceneMode.SCENE2D,
            baseLayer: false, terrain: false
        });
        state.viewer.imageryLayers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }));
        state.viewer.scene.screenSpaceCameraController.enableTilt = false;
        state.viewer.screenSpaceEventHandler.setInputAction((movement) => {
            const picked = state.viewer.scene.pick(movement.position);
            const entity = picked?.id;
            if (entity && state.entities.has(entity.id)) openEvent(state.entities.get(entity.id));
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    async function start() {
        if (!window.Cesium || !window.SentinelData) { setStatus("Cesium prototype dependencies unavailable", true); return; }
        try {
            setupViewer();
            const snapshot = await new window.SentinelData.Client().load();
            state.events = snapshot.events;
            updateFilters();
            plotEvents(state.events);
            renderFeed();
            $("#cesium-events span").textContent = state.events.length.toLocaleString();
            setStatus(`${state.events.length.toLocaleString()} valid plotted signals · 2D Cesium renderer`);
        } catch (error) {
            setStatus(`Sentinel publication unavailable: ${error.message}`, true);
            $("#cesium-feed").innerHTML = '<div class="cesium-empty">The map could not load the published event data.</div>';
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        $("#cesium-events").addEventListener("click", () => {
            const drawer = $("#cesium-drawer");
            const open = drawer.classList.toggle("is-open");
            drawer.setAttribute("aria-hidden", String(!open));
            $("#cesium-events").setAttribute("aria-expanded", String(open));
        });
        $("#cesium-close").addEventListener("click", () => $("#cesium-events").click());
        $("#cesium-category").addEventListener("change", renderFeed);
        $("#cesium-severity").addEventListener("change", renderFeed);
        start();
    });
}());

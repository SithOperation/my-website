(function () {
    "use strict";

    const DATA_REFRESH_MS = 5 * 60 * 1000;
    const INITIAL_CENTER = [0, 20];
    const INITIAL_ZOOM = 2;
    const THREAT_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
    const client = new window.SentinelData.Client({ root: "data" });

    let map = null;
    let mapReady = false;
    let allEvents = [];
    let filteredEvents = [];
    let eventIndex = new Map();

    const element = id => document.getElementById(id);

    function formatDate(value) {
        if (!value) return "Unknown";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    }

    function displayType(value) {
        return String(value || "unknown")
            .replace(/_/g, " ")
            .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function setStatus(message, state) {
        const status = element("ops-status");
        element("ops-status-text").textContent = message;
        status.className = `ops-status is-${state}`;
    }

    function setLoading(visible, message = "Building operational picture...") {
        const loading = element("map-loading");
        loading.lastChild.textContent = message;
        loading.classList.toggle("is-hidden", !visible);
    }

    function featureCollection(events) {
        return {
            type: "FeatureCollection",
            features: events.map((event, index) => {
                const mapId = event.event_id || `sentinel-${index}-${event.latitude}-${event.longitude}`;
                eventIndex.set(mapId, event);
                return {
                    type: "Feature",
                    id: mapId,
                    geometry: {
                        type: "Point",
                        coordinates: [event.longitude, event.latitude]
                    },
                    properties: {
                        map_id: mapId,
                        title: event.title,
                        type: event.type,
                        threat_level: event.threat_level,
                        confidence: event.confidence ?? 0,
                        timestamp: event.timestamp || ""
                    }
                };
            })
        };
    }

    function mapStyle() {
        return {
            version: 8,
            glyphs: "assets/map-fonts/{fontstack}/{range}.pbf",
            sources: {
                osm: {
                    type: "raster",
                    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                    tileSize: 256,
                    attribution: "© OpenStreetMap contributors",
                    maxzoom: 19
                }
            },
            layers: [{
                id: "osm-dark",
                type: "raster",
                source: "osm",
                paint: {
                    "raster-saturation": -0.82,
                    "raster-contrast": 0.38,
                    "raster-brightness-min": 0.02,
                    "raster-brightness-max": 0.48,
                    "raster-fade-duration": 0
                }
            }]
        };
    }

    function threatColorExpression() {
        return [
            "match", ["get", "threat_level"],
            "CRITICAL", "#ff174f",
            "HIGH", "#ff8200",
            "MEDIUM", "#ffd400",
            "LOW", "#00f0ff",
            "#8ca6ad"
        ];
    }

    function addIntelligenceLayers() {
        map.addSource("sentinel-events", {
            type: "geojson",
            data: featureCollection([]),
            cluster: true,
            clusterMaxZoom: 9,
            clusterRadius: 54,
            clusterMinPoints: 2
        });

        map.addLayer({
            id: "cluster-glow",
            type: "circle",
            source: "sentinel-events",
            filter: ["has", "point_count"],
            paint: {
                "circle-color": "#00f0ff",
                "circle-radius": ["step", ["get", "point_count"], 23, 20, 31, 100, 42],
                "circle-opacity": 0.12,
                "circle-blur": 0.65
            }
        });

        map.addLayer({
            id: "clusters",
            type: "circle",
            source: "sentinel-events",
            filter: ["has", "point_count"],
            paint: {
                "circle-color": ["step", ["get", "point_count"], "#07343b", 20, "#14454a", 100, "#5a2735"],
                "circle-radius": ["step", ["get", "point_count"], 16, 20, 22, 100, 29],
                "circle-stroke-width": 2,
                "circle-stroke-color": ["step", ["get", "point_count"], "#00f0ff", 100, "#ff174f"]
            }
        });

        map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "sentinel-events",
            filter: ["has", "point_count"],
            layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-size": 12,
                "text-font": ["Noto Sans Regular"]
            },
            paint: { "text-color": "#e9fbff" }
        });

        map.addLayer({
            id: "event-glow",
            type: "circle",
            source: "sentinel-events",
            filter: ["!", ["has", "point_count"]],
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 10, 8, 17],
                "circle-color": threatColorExpression(),
                "circle-opacity": 0.2,
                "circle-blur": 0.7
            }
        });

        map.addLayer({
            id: "events",
            type: "circle",
            source: "sentinel-events",
            filter: ["!", ["has", "point_count"]],
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 4.5, 8, 7.5],
                "circle-color": threatColorExpression(),
                "circle-opacity": 0.92,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#ffffff"
            }
        });

        map.on("click", "clusters", async event => {
            const feature = event.features?.[0];
            if (!feature) return;
            const source = map.getSource("sentinel-events");
            try {
                const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
                map.easeTo({ center: feature.geometry.coordinates, zoom, duration: 550 });
            }
            catch (error) {
                console.warn("Unable to expand Sentinel cluster", error);
            }
        });

        map.on("click", "events", event => {
            const feature = event.features?.[0];
            if (!feature) return;
            const selected = eventIndex.get(String(feature.properties.map_id));
            if (selected) renderEventDetail(selected);
        });

        ["clusters", "events"].forEach(layer => {
            map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        });
    }

    function initializeMap() {
        if (!window.maplibregl?.Map) {
            throw new Error("The MapLibre renderer could not be loaded.");
        }

        map = new window.maplibregl.Map({
            container: "sentinel-map",
            style: mapStyle(),
            center: INITIAL_CENTER,
            zoom: INITIAL_ZOOM,
            minZoom: 1.5,
            maxZoom: 16,
            renderWorldCopies: true,
            attributionControl: true,
            cooperativeGestures: true,
            fadeDuration: 0
        });

        map.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
        map.addControl(new window.maplibregl.FullscreenControl(), "top-right");
        map.addControl(new window.maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

        map.on("load", () => {
            addIntelligenceLayers();
            mapReady = true;
            element("sentinel-map").dataset.mapReady = "true";
            updateMapData();
        });

        map.on("error", event => {
            if (event.error) console.warn("Sentinel map resource error", event.error);
        });
    }

    function filterEvents() {
        const type = element("filter-type").value;
        const threat = element("filter-threat").value;
        const minimumConfidence = Number(element("filter-confidence").value);
        const hours = element("filter-time").value;
        const threshold = hours === "all" ? null : Date.now() - Number(hours) * 60 * 60 * 1000;

        filteredEvents = allEvents.filter(event => {
            if (type !== "all" && event.type !== type) return false;
            if (threat !== "all" && event.threat_level !== threat) return false;
            if (minimumConfidence && (event.confidence === null || event.confidence < minimumConfidence)) return false;
            if (threshold) {
                const timestamp = Date.parse(event.timestamp || "");
                if (!Number.isFinite(timestamp) || timestamp < threshold) return false;
            }
            return true;
        });
    }

    function updateMapData() {
        filterEvents();
        eventIndex = new Map();

        if (mapReady) {
            map.getSource("sentinel-events").setData(featureCollection(filteredEvents));
            map.triggerRepaint();
            window.setTimeout(() => {
                element("sentinel-map").dataset.renderedFeatures = String(
                    map.querySourceFeatures("sentinel-events").length
                );
                setLoading(false);
            }, 350);
        }

        element("ops-mapped").textContent = filteredEvents.length.toLocaleString();
        element("map-count").textContent = filteredEvents.length ?
            `${filteredEvents.length.toLocaleString()} mapped signals` :
            "No signals match the active filters";
    }

    function populateSelect(select, values, firstLabel, formatter = value => value) {
        const previous = select.value;
        select.replaceChildren(new Option(firstLabel, "all"));
        values.forEach(value => select.add(new Option(formatter(value), value)));
        select.value = values.includes(previous) ? previous : "all";
    }

    function populateFilters() {
        const types = Array.from(new Set(allEvents.map(event => event.type))).sort();
        const threats = Array.from(new Set(allEvents.map(event => event.threat_level)))
            .sort((a, b) => THREAT_ORDER.indexOf(a) - THREAT_ORDER.indexOf(b));
        populateSelect(element("filter-type"), types, "All event types", displayType);
        populateSelect(element("filter-threat"), threats, "All threat levels");
    }

    function appendDefinition(list, label, value, className = "") {
        const term = document.createElement("dt");
        const definition = document.createElement("dd");
        term.textContent = label;
        definition.textContent = value;
        if (className) definition.className = className;
        list.append(term, definition);
    }

    function sourceText(event) {
        if (Array.isArray(event.source)) return event.source.join(", ");
        return String(event.source || "Sentinel Grid");
    }

    function renderEventDetail(event) {
        const panel = element("event-detail");
        const heading = document.createElement("h3");
        const summary = document.createElement("p");
        const details = document.createElement("dl");

        heading.textContent = event.title;
        summary.textContent = event.description;
        appendDefinition(details, "Threat level", event.threat_level, `threat-${event.threat_level.toLowerCase()}`);
        appendDefinition(details, "Category", displayType(event.type));
        appendDefinition(details, "Confidence", event.confidence === null ? "Not reported" : `${event.confidence}%`);
        appendDefinition(details, "Observed", formatDate(event.timestamp));
        appendDefinition(details, "Source", sourceText(event));
        appendDefinition(details, "Coordinates", `${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`);
        if (event.event_id) appendDefinition(details, "Event ID", event.event_id);

        panel.replaceChildren(heading, summary, details);
    }

    function renderHealth(snapshot) {
        const coverage = element("coverage-message");
        const sources = element("coverage-sources");
        const healthState = snapshot.healthState;
        coverage.textContent = healthState.message;
        sources.replaceChildren();

        healthState.failedSources.slice(0, 6).forEach(source => {
            const item = document.createElement("li");
            item.textContent = `${source.name || source.source || "Source"}: ${source.status || "degraded"}`;
            sources.appendChild(item);
        });

        if (snapshot.legacy) {
            const item = document.createElement("li");
            item.textContent = "Manifest metadata unavailable; displaying validated legacy files.";
            sources.appendChild(item);
        }
    }

    function applySnapshot(snapshot) {
        const summary = snapshot.dashboard.summary || {};
        const criticalEvents = Array.isArray(snapshot.dashboard.critical_events) ? snapshot.dashboard.critical_events : [];
        const generated = snapshot.manifest.generated || snapshot.dashboard.generated;

        element("ops-threat").textContent = String(summary.global_threat_level || summary.threat_level || "UNKNOWN");
        element("ops-total").textContent = Number(summary.total_events || snapshot.events.length).toLocaleString();
        element("ops-critical").textContent = criticalEvents.length.toLocaleString();
        element("ops-generated").textContent = formatDate(generated);

        allEvents = snapshot.events;
        populateFilters();
        renderHealth(snapshot);
        updateMapData();

        const state = snapshot.legacy ? "degraded" : snapshot.healthState.state;
        const message = snapshot.legacy ?
            "Operational with legacy publication metadata" :
            `${snapshot.healthState.message} Publication ${snapshot.manifest.publication_id}`;
        setStatus(message, state);
    }

    async function refresh(options = {}) {
        try {
            const snapshot = await client.load(options);
            if (!snapshot.unchanged || !allEvents.length) applySnapshot(snapshot);
            else if (snapshot.manifestUnavailable) setStatus("Manifest check failed; last valid publication retained", "degraded");
        }
        catch (error) {
            console.error("Sentinel publication failed", error);
            setStatus(error.message || "Sentinel publication unavailable", "error");
            if (!allEvents.length) {
                setLoading(false);
                element("map-count").textContent = "Intelligence data unavailable";
            }
        }
    }

    function bindControls() {
        ["filter-type", "filter-threat", "filter-confidence", "filter-time"].forEach(id => {
            element(id).addEventListener("change", updateMapData);
        });

        element("reset-filters").addEventListener("click", () => {
            element("filter-type").value = "all";
            element("filter-threat").value = "all";
            element("filter-confidence").value = "0";
            element("filter-time").value = "all";
            updateMapData();
        });

        element("reset-view").addEventListener("click", () => {
            map?.easeTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM, pitch: 0, bearing: 0, duration: 500 });
        });

        element("mobile-panel-toggle").addEventListener("click", event => {
            const open = element("filter-content").classList.toggle("is-open");
            event.currentTarget.setAttribute("aria-expanded", String(open));
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindControls();
        try {
            initializeMap();
        }
        catch (error) {
            console.error("MapLibre initialization failed", error);
            setStatus(error.message, "error");
            setLoading(false);
        }

        refresh();
        window.setInterval(() => {
            if (document.visibilityState === "visible") refresh();
        }, DATA_REFRESH_MS);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                map?.resize();
                refresh();
            }
        });
    });
}());

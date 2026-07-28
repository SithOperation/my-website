(function () {
    "use strict";

    const DATA_REFRESH_MS = 5 * 60 * 1000;
    const INITIAL_CENTER = [0, 20];
    const INITIAL_ZOOM = 2;
    const THREAT_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
    const client = new window.SentinelData.Client({ root: "data" });
    const earlyReportFeed = new window.SentinelData.GenerationFeed(client, {
        metadataFile: "output/x_report_events.json",
        dataFile: "output/x_report_pinpoints.geojson"
    });

    let map = null;
    let mapReady = false;
    let allEvents = [];
    let filteredEvents = [];
    let eventIndex = new Map();
    let coordinateCounts = new Map();
    let disasterIndex = new Map();
    let earlyReportIndex = new Map();
    let earlyReportCount = 0;
    let earlyReportPopup = null;
    let earlyReportPopupId = null;
    let environmentalCount = 0;
    let environmentalEvents = { earthquakes: [], volcanoes: [], weather: [] };
    let highlightedEventId = null;

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

    function symbolType(value) {
        const type = String(value || "news").toLowerCase();
        const aliases = {
            conflict: "conflict",
            earthquake: "earthquake",
            humanitarian: "news",
            military_exercise: "military_exercise",
            news: "news",
            prescribed_fire: "prescribed_fire",
            reddit_report: "news",
            satellite: "satellite",
            tropical_cyclone: "weather",
            volcano: "volcano",
            weather: "weather",
            weather_alert: "weather",
            wildfire: "wildfire",
            x_report: "news"
        };
        return aliases[type] || "news";
    }

    function isSourceReportedEvent(event) {
        return String(event?.location_status || "").toLowerCase() === "source_reported" ||
            ["source_reported", "unverified"].includes(String(event?.claim_status || "").toLowerCase());
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
        eventIndex.clear();
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
                        symbol_type: symbolType(event.type),
                        threat_level: event.threat_level,
                        confidence: event.confidence ?? 0,
                        timestamp: event.timestamp || "",
                        heading: Number(aircraftValue(event, "heading", "track")) || 0,
                        source_reported: isSourceReportedEvent(event)
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

    function createAircraftIcon() {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext("2d");

        context.translate(32, 32);
        context.fillStyle = "#e9fbff";
        context.strokeStyle = "#00f0ff";
        context.lineWidth = 2;
        context.shadowColor = "#00f0ff";
        context.shadowBlur = 8;
        context.beginPath();
        context.moveTo(0, -27);
        context.lineTo(6, -8);
        context.lineTo(25, 3);
        context.lineTo(25, 9);
        context.lineTo(6, 4);
        context.lineTo(5, 19);
        context.lineTo(13, 25);
        context.lineTo(13, 28);
        context.lineTo(0, 24);
        context.lineTo(-13, 28);
        context.lineTo(-13, 25);
        context.lineTo(-5, 19);
        context.lineTo(-6, 4);
        context.lineTo(-25, 9);
        context.lineTo(-25, 3);
        context.lineTo(-6, -8);
        context.closePath();
        context.fill();
        context.stroke();

        return context.getImageData(0, 0, 64, 64);
    }

    function createCategoryIcon(type) {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 48;
        const context = canvas.getContext("2d");
        context.translate(24, 24);
        context.lineWidth = 3;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = "#e9fbff";
        context.fillStyle = ({ conflict: "#ff174f", news: "#00f0ff", satellite: "#9b7bff", wildfire: "#ff5a1f", prescribed_fire: "#d99a4e", military_exercise: "#b8c4cc", earthquake: "#ffd400", volcano: "#ff8200", weather: "#44bfff" })[type] || "#8ca6ad";
        context.shadowColor = context.fillStyle;
        context.shadowBlur = 7;
        context.beginPath();

        if (type === "wildfire" || type === "prescribed_fire") {
            context.font = '26px "Segoe UI Emoji", sans-serif';
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.shadowBlur = 4;
            context.fillText("🔥", 0, -1);
            if (type === "prescribed_fire") {
                context.shadowBlur = 0;
                context.fillStyle = "#16110a";
                context.fillRect(-12, 9, 24, 10);
                context.fillStyle = "#ffe2a6";
                context.font = "bold 8px monospace";
                context.fillText("RX", 0, 14);
            }
            return context.getImageData(0, 0, 48, 48);
        }
        if (type === "conflict") {
            context.rect(-11, -11, 22, 22);
            context.moveTo(-16, 0); context.lineTo(16, 0);
            context.moveTo(0, -16); context.lineTo(0, 16);
        }
        else if (type === "news") {
            context.arc(0, 0, 12, 0, Math.PI * 2);
            context.moveTo(0, -6); context.lineTo(0, 3);
            context.moveTo(0, 8); context.lineTo(0, 8.5);
        }
        else if (type === "satellite") {
            context.rect(-7, -7, 14, 14);
            context.moveTo(-7, -4); context.lineTo(-17, -10); context.lineTo(-17, 3); context.lineTo(-7, 4);
            context.moveTo(7, -4); context.lineTo(17, -10); context.lineTo(17, 3); context.lineTo(7, 4);
        }
        else if (type === "earthquake") {
            context.moveTo(-16, 1); context.lineTo(-7, -5); context.lineTo(-2, 8); context.lineTo(5, -10); context.lineTo(9, 3); context.lineTo(16, -2);
        }
        else if (type === "volcano") {
            context.moveTo(-16, 13); context.lineTo(-5, -9); context.lineTo(0, -5); context.lineTo(5, -9); context.lineTo(16, 13); context.closePath();
            context.moveTo(-4, -14); context.quadraticCurveTo(0, -22, 4, -14);
        }
        else if (type === "weather") {
            context.arc(-7, 3, 7, Math.PI, 0); context.arc(2, -3, 10, Math.PI, 0); context.arc(11, 4, 7, Math.PI, 0); context.lineTo(-14, 10); context.closePath();
        }
        else {
            context.arc(0, 0, 11, 0, Math.PI * 2);
        }

        context.fill();
        context.stroke();
        return context.getImageData(0, 0, 48, 48);
    }

    function isMilitaryAircraft(event) {
        if (event.type !== "aircraft") return true;
        const classification = String(event.classification || event.aircraft?.classification || "").toLowerCase();
        return event.is_military === true || event.military === true || event.aircraft?.is_military === true ||
            ["military", "military_aircraft", "military-aviation"].includes(classification);
    }

    function addIntelligenceLayers() {
        if (!map.hasImage("military-aircraft")) {
            map.addImage("military-aircraft", createAircraftIcon(), { pixelRatio: 2 });
        }
        ["conflict", "news", "satellite", "wildfire", "prescribed_fire", "military_exercise", "earthquake", "volcano", "weather"].forEach(type => {
            if (!map.hasImage(`marker-${type}`)) map.addImage(`marker-${type}`, createCategoryIcon(type), { pixelRatio: 2 });
        });

        map.addSource("sentinel-events", {
            type: "geojson",
            data: featureCollection([]),
            cluster: true,
            clusterMaxZoom: 5,
            clusterRadius: 45,
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
            filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "type"], "aircraft"]],
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 10, 8, 17],
                "circle-color": threatColorExpression(),
                "circle-opacity": 0.2,
                "circle-blur": 0.7
            }
        });

        map.addLayer({
            id: "source-reported-halo",
            type: "circle",
            source: "sentinel-events",
            filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "source_reported"], true]],
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 12, 8, 20],
                "circle-color": "rgba(0,0,0,0)",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
                "circle-stroke-opacity": 0.72
            }
        });

        map.addLayer({
            id: "association-highlight",
            type: "circle",
            source: "sentinel-events",
            filter: ["!", ["has", "point_count"]],
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 17, 8, 28],
                "circle-color": "rgba(0,0,0,0)",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": [
                    "case", ["boolean", ["feature-state", "sourceHighlight"], false], 4, 0
                ],
                "circle-stroke-opacity": [
                    "case", ["boolean", ["feature-state", "sourceHighlight"], false], 1, 0
                ]
            }
        });

        map.addLayer({
            id: "events",
            type: "symbol",
            source: "sentinel-events",
            filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "type"], "aircraft"]],
            layout: {
                "icon-image": ["concat", "marker-", ["get", "symbol_type"]],
                "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.55, 8, 0.85],
                "icon-allow-overlap": false,
                "icon-padding": 2
            }
        });

        map.addLayer({
            id: "military-aircraft-glow",
            type: "circle",
            source: "sentinel-events",
            filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "type"], "aircraft"]],
            paint: {
                "circle-radius": 16,
                "circle-color": "#00f0ff",
                "circle-opacity": 0.16,
                "circle-blur": 0.7
            }
        });

        map.addLayer({
            id: "military-aircraft",
            type: "symbol",
            source: "sentinel-events",
            filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "type"], "aircraft"]],
            layout: {
                "icon-image": "military-aircraft",
                "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.45, 8, 0.7],
                "icon-rotate": ["coalesce", ["to-number", ["get", "heading"]], 0],
                "icon-rotation-alignment": "map",
                "icon-allow-overlap": true
            }
        });

        map.on("click", "clusters", async event => {
            const feature = event.features?.[0];
            if (!feature) return;
            const source = map.getSource("sentinel-events");
            try {
                const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
                if (map.getZoom() < 4 && zoom <= 5) {
                    map.easeTo({ center: feature.geometry.coordinates, zoom, duration: 450 });
                    return;
                }

                const leaves = await source.getClusterLeaves(feature.properties.cluster_id, 50, 0);
                const events = leaves
                    .map(leaf => eventIndex.get(String(leaf.properties.map_id)))
                    .filter(Boolean);
                renderEventGroup(events, Number(feature.properties.point_count));
            }
            catch (error) {
                console.warn("Unable to expand Sentinel cluster", error);
            }
        });

        const selectRenderedEvent = event => {
            const feature = event.features?.[0];
            if (!feature) return;
            const point = event.point;
            const nearbyFeatures = map.queryRenderedFeatures([
                [point.x - 7, point.y - 7],
                [point.x + 7, point.y + 7]
            ], { layers: ["events", "military-aircraft"] });
            const events = Array.from(new Set(nearbyFeatures.map(item => String(item.properties.map_id))))
                .map(id => eventIndex.get(id))
                .filter(Boolean);

            if (events.length > 1) renderEventGroup(events, events.length);
            else if (events[0]) renderEventDetail(events[0]);
        };

        map.on("click", "events", selectRenderedEvent);
        map.on("click", "military-aircraft", selectRenderedEvent);

        ["clusters", "events", "military-aircraft"].forEach(layer => {
            map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        });
    }

    function normalizeDisasterEvent(event) {
        const latitude = Number(event.coordinates?.lat);
        const longitude = Number(event.coordinates?.lon);
        const details = event.details || {};
        const timestamp = details.published || details.time || details.sent ||
            details.effective || details.expires || null;
        return {
            ...event,
            event_id: String(event.id || ""),
            title: window.SentinelData.cleanText(event.title || "Environmental signal", 180),
            description: window.SentinelData.cleanText(details.description || details.message || details.instruction || event.location || "No summary is available.", 700),
            latitude: Number.isFinite(latitude) ? latitude : null,
            longitude: Number.isFinite(longitude) ? longitude : null,
            type: String(event.type || "environmental").toLowerCase(),
            threat_level: ({ extreme: "CRITICAL", severe: "HIGH", high: "HIGH", moderate: "MEDIUM", minor: "LOW", low: "LOW" })[String(event.severity || "").toLowerCase()] || "UNKNOWN",
            confidence: null,
            timestamp: typeof timestamp === "number" ? new Date(timestamp).toISOString() : timestamp,
            source: event.source || "Environmental monitor"
        };
    }

    function pointFeatures(events) {
        return {
            type: "FeatureCollection",
            features: events.filter(event => Number.isFinite(event.latitude) && Number.isFinite(event.longitude)).map(event => {
                disasterIndex.set(event.event_id, event);
                return {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [event.longitude, event.latitude] },
                    properties: { map_id: event.event_id, type: event.type, title: event.title }
                };
            })
        };
    }

    function validPolygonGeometry(event) {
        const geometry = event.coordinates;
        if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type) || !Array.isArray(geometry.polygon)) return null;
        const coordinates = geometry.polygon;
        return { type: geometry.type, coordinates };
    }

    function retainRecentEvents(events) {
        return events.filter(event =>
            window.SentinelData.isWithinRetentionWindow(event.timestamp)
        );
    }

    function retainedEarlyReportGeojson(geojson) {
        return {
            ...geojson,
            features: (geojson.features || []).filter(feature =>
                window.SentinelData.isWithinRetentionWindow(
                    feature.properties?.published_at
                )
            )
        };
    }

    function addEnvironmentalPointLayer(sourceId, layerId, events, icon, clustered) {
        map.addSource(sourceId, {
            type: "geojson",
            data: pointFeatures(events),
            cluster: clustered,
            clusterMaxZoom: 5,
            clusterRadius: 36
        });
        if (clustered) {
            map.addLayer({ id: `${layerId}-clusters`, type: "circle", source: sourceId, filter: ["has", "point_count"], paint: { "circle-radius": ["step", ["get", "point_count"], 13, 20, 19], "circle-color": "#3d3510", "circle-stroke-color": "#ffd400", "circle-stroke-width": 2 } });
            map.addLayer({ id: `${layerId}-count`, type: "symbol", source: sourceId, filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 10 }, paint: { "text-color": "#ffffff" } });
            map.on("click", `${layerId}-clusters`, async click => {
                const feature = click.features?.[0];
                if (!feature) return;
                const zoom = await map.getSource(sourceId).getClusterExpansionZoom(feature.properties.cluster_id);
                map.easeTo({ center: feature.geometry.coordinates, zoom: Math.min(6, zoom), duration: 400 });
            });
        }
        const pointLayer = { id: layerId, type: "symbol", source: sourceId, layout: { "icon-image": icon, "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.55, 8, 0.85], "icon-allow-overlap": false } };
        if (clustered) pointLayer.filter = ["!", ["has", "point_count"]];
        map.addLayer(pointLayer);
        map.on("click", layerId, click => {
            const selected = disasterIndex.get(String(click.features?.[0]?.properties?.map_id));
            if (selected) renderEventDetail(selected);
        });
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
    }

    function appendEarlyReportField(container, label, value) {
        if (value === null || value === undefined || String(value).trim() === "") return;
        const row = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = `${label}: `;
        row.append(name, document.createTextNode(String(value)));
        container.append(row);
    }

    function formatEarlyReportTimestamp(value) {
        if (!value) return "";
        const timestamp = new Date(value);
        if (Number.isNaN(timestamp.getTime())) return "";
        return timestamp.toLocaleString([], {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short"
        });
    }

    function formatEarlyReportConfidence(value) {
        const confidence = Number(value);
        if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return "";
        const percentage = confidence * 100;
        return `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`;
    }

    function formatEarlyReportAccount(value) {
        const account = String(value || "").trim().replace(/^@+/, "");
        return account ? `@${account}` : "";
    }

    function safeOriginalXUrl(value) {
        try {
            const url = new URL(String(value || ""));
            if (
                url.protocol !== "https:" ||
                url.hostname !== "x.com" ||
                !/^\/[A-Za-z0-9_]{1,15}\/status\/[0-9]+$/.test(url.pathname) ||
                url.search ||
                url.hash
            ) return "";
            return url.href;
        } catch {
            return "";
        }
    }

    function buildEarlyReportDetail(properties) {
        const content = document.createElement("article");
        content.className = "early-report-detail";
        const title = document.createElement("h3");
        const warning = document.createElement("p");
        title.textContent = "Social Media Early Report";
        warning.className = "warning";
        warning.textContent = "EARLY REPORT — verify against additional sources";
        content.append(title, warning);
        appendEarlyReportField(content, "Account", formatEarlyReportAccount(properties.account));
        appendEarlyReportField(content, "Summary", properties.summary);
        appendEarlyReportField(content, "First reported", formatEarlyReportTimestamp(properties.published_at));
        appendEarlyReportField(content, "Location", properties.location_name);
        appendEarlyReportField(content, "Event type", displayType(properties.event_type));
        appendEarlyReportField(content, "Source classification", displayType(properties.source_class));
        appendEarlyReportField(content, "Verification", displayType(properties.verification_status));
        appendEarlyReportField(content, "Confidence", formatEarlyReportConfidence(properties.confidence));
        appendEarlyReportField(content, "Location precision", displayType(properties.location_precision));
        const originalUrl = safeOriginalXUrl(properties.source_url);
        if (originalUrl) {
            const link = document.createElement("a");
            link.href = originalUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "View original report";
            content.append(link);
        }
        return content;
    }

    window.SentinelXReportPopup = Object.freeze({
        buildEarlyReportDetail,
        formatEarlyReportAccount,
        formatEarlyReportConfidence,
        formatEarlyReportTimestamp,
        safeOriginalXUrl
    });

    function indexEarlyReports(geojson) {
        earlyReportIndex = new Map();
        (geojson.features || []).forEach(feature => {
            const properties = feature.properties || {};
            earlyReportIndex.set(String(properties.id), properties);
        });
        earlyReportCount = earlyReportIndex.size;
        if (earlyReportPopupId && !earlyReportIndex.has(earlyReportPopupId)) {
            earlyReportPopup?.remove();
            earlyReportPopup = null;
            earlyReportPopupId = null;
        }
        else if (earlyReportPopupId && earlyReportPopup) {
            earlyReportPopup.setDOMContent(
                buildEarlyReportDetail(earlyReportIndex.get(earlyReportPopupId))
            );
        }
    }

    async function refreshEarlyReportLayer() {
        if (!mapReady || !map?.getSource("x-early-reports-source")) return;
        const snapshot = await earlyReportFeed.load();
        const retained = retainedEarlyReportGeojson(snapshot.data);
        indexEarlyReports(retained);
        map.getSource("x-early-reports-source").setData(retained);
        map.triggerRepaint();
        updateMapCount();
    }

    async function loadEarlyReportLayer() {
        const snapshot = await earlyReportFeed.load();
        const geojson = retainedEarlyReportGeojson(snapshot.data);
        const markerImage = await map.loadImage("assets/images/x-early-report-pinpoint.png");
        if (!map.hasImage("x-early-report-pinpoint")) {
            map.addImage("x-early-report-pinpoint", markerImage.data);
        }
        indexEarlyReports(geojson);
        map.addSource("x-early-reports-source", {
            type: "geojson",
            data: geojson,
            cluster: true,
            clusterMaxZoom: 7,
            clusterRadius: 38,
            clusterMinPoints: 2
        });
        map.addLayer({
            id: "x-early-report-cluster-glow",
            type: "circle",
            source: "x-early-reports-source",
            filter: ["has", "point_count"],
            paint: {
                "circle-radius": ["step", ["get", "point_count"], 22, 10, 29],
                "circle-color": "#ff9f1c",
                "circle-opacity": 0.16,
                "circle-blur": 0.55
            }
        });
        map.addLayer({
            id: "x-early-report-clusters",
            type: "circle",
            source: "x-early-reports-source",
            filter: ["has", "point_count"],
            paint: {
                "circle-radius": ["step", ["get", "point_count"], 16, 10, 21],
                "circle-color": "#161616",
                "circle-stroke-color": "#ffbf47",
                "circle-stroke-width": 2
            }
        });
        map.addLayer({
            id: "x-early-report-cluster-count",
            type: "symbol",
            source: "x-early-reports-source",
            filter: ["has", "point_count"],
            layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-font": ["Noto Sans Regular"],
                "text-size": 11
            },
            paint: { "text-color": "#ffffff" }
        });
        map.addLayer({
            id: "x-early-reports",
            type: "symbol",
            source: "x-early-reports-source",
            filter: ["!", ["has", "point_count"]],
            layout: {
                "icon-image": "x-early-report-pinpoint",
                "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.16, 8, 0.25],
                "icon-allow-overlap": false,
                "icon-padding": 3
            }
        });
        map.on("click", "x-early-report-clusters", async click => {
            const feature = click.features?.[0];
            if (!feature) return;
            const zoom = await map.getSource("x-early-reports-source")
                .getClusterExpansionZoom(feature.properties.cluster_id);
            map.easeTo({ center: feature.geometry.coordinates, zoom: Math.min(9, zoom), duration: 450 });
        });
        map.on("click", "x-early-reports", click => {
            const feature = click.features?.[0];
            const properties = earlyReportIndex.get(String(feature?.properties?.id));
            if (!feature || !properties) return;
            earlyReportPopup?.remove();
            earlyReportPopupId = String(properties.id);
            earlyReportPopup = new window.maplibregl.Popup({ maxWidth: "390px", offset: 10 })
                .setLngLat(feature.geometry.coordinates)
                .setDOMContent(buildEarlyReportDetail(properties))
                .addTo(map);
        });
        ["x-early-report-clusters", "x-early-reports"].forEach(layerId => {
            map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
        });
        applyLayerVisibility();
        updateMapCount();
    }

    async function loadEnvironmentalLayers() {
        const files = ["earthquakes.json", "volcanoes.json", "weather.json"];
        const results = await Promise.allSettled(files.map(file => client.fetchJSON(file)));
        const [earthquakes, volcanoes, weather] = results.map(result => result.status === "fulfilled" && Array.isArray(result.value) ? result.value.map(normalizeDisasterEvent) : []);
        environmentalEvents = { earthquakes, volcanoes, weather };
        const recentEarthquakes = retainRecentEvents(earthquakes);
        const recentVolcanoes = retainRecentEvents(volcanoes);
        const recentWeather = retainRecentEvents(weather);

        addEnvironmentalPointLayer("earthquake-source", "earthquakes", recentEarthquakes, "marker-earthquake", true);
        addEnvironmentalPointLayer("volcano-source", "volcanoes", recentVolcanoes, "marker-volcano", false);

        const weatherFeatures = recentWeather.map(event => {
            const geometry = validPolygonGeometry(event);
            if (!geometry) return null;
            disasterIndex.set(event.event_id, event);
            return { type: "Feature", geometry, properties: { map_id: event.event_id, title: event.title } };
        }).filter(Boolean);
        environmentalCount = recentEarthquakes.filter(event => Number.isFinite(event.latitude) && Number.isFinite(event.longitude)).length +
            recentVolcanoes.filter(event => Number.isFinite(event.latitude) && Number.isFinite(event.longitude)).length + weatherFeatures.length;
        map.addSource("weather-source", { type: "geojson", data: { type: "FeatureCollection", features: weatherFeatures } });
        map.addLayer({ id: "weather-fill", type: "fill", source: "weather-source", paint: { "fill-color": "#44bfff", "fill-opacity": 0.13 } });
        map.addLayer({ id: "weather-line", type: "line", source: "weather-source", paint: { "line-color": "#44bfff", "line-width": 1.5, "line-dasharray": [2, 2] } });
        map.on("click", "weather-fill", click => {
            const selected = disasterIndex.get(String(click.features?.[0]?.properties?.map_id));
            if (selected) renderEventDetail(selected);
        });
        const weatherPopup = new window.maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: "330px" });
        map.on("mousemove", "weather-fill", move => {
            const selected = disasterIndex.get(String(move.features?.[0]?.properties?.map_id));
            if (!selected) return;
            const content = document.createElement("div");
            const heading = document.createElement("strong");
            const location = document.createElement("span");
            const summary = document.createElement("p");
            heading.textContent = selected.title;
            location.textContent = `${selected.threat_level} · ${selected.location || "Weather alert area"}`;
            summary.textContent = selected.description.length > 220 ? `${selected.description.slice(0, 219)}…` : selected.description;
            content.className = "weather-hover-card";
            content.append(heading, location, summary);
            weatherPopup.setLngLat(move.lngLat).setDOMContent(content).addTo(map);
            map.getCanvas().style.cursor = "help";
        });
        map.on("mouseleave", "weather-fill", () => {
            weatherPopup.remove();
            map.getCanvas().style.cursor = "";
        });
        applyLayerVisibility();
        updateMapData();
    }

    function refreshEnvironmentalRetention() {
        if (!mapReady) return;
        disasterIndex = new Map();
        const earthquakes = retainRecentEvents(environmentalEvents.earthquakes);
        const volcanoes = retainRecentEvents(environmentalEvents.volcanoes);
        const weather = retainRecentEvents(environmentalEvents.weather);
        const weatherFeatures = weather.map(event => {
            const geometry = validPolygonGeometry(event);
            if (!geometry) return null;
            disasterIndex.set(event.event_id, event);
            return {
                type: "Feature",
                geometry,
                properties: { map_id: event.event_id, title: event.title }
            };
        }).filter(Boolean);
        map.getSource("earthquake-source")?.setData(pointFeatures(earthquakes));
        map.getSource("volcano-source")?.setData(pointFeatures(volcanoes));
        map.getSource("weather-source")?.setData({
            type: "FeatureCollection",
            features: weatherFeatures
        });
        environmentalCount =
            earthquakes.filter(event =>
                Number.isFinite(event.latitude) && Number.isFinite(event.longitude)
            ).length +
            volcanoes.filter(event =>
                Number.isFinite(event.latitude) && Number.isFinite(event.longitude)
            ).length +
            weatherFeatures.length;
        updateMapCount();
    }

    function setLayersVisible(ids, visible) {
        ids.forEach(id => { if (map?.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none"); });
    }

    function applyLayerVisibility() {
        setLayersVisible(["cluster-glow", "clusters", "cluster-count", "event-glow", "events", "military-aircraft-glow", "military-aircraft"], element("layer-intelligence").checked);
        setLayersVisible(["earthquakes-clusters", "earthquakes-count", "earthquakes"], element("layer-earthquakes").checked);
        setLayersVisible(["volcanoes"], element("layer-volcanoes").checked);
        setLayersVisible(["weather-fill", "weather-line"], element("layer-weather").checked);
        setLayersVisible([
            "x-early-report-cluster-glow",
            "x-early-report-clusters",
            "x-early-report-cluster-count",
            "x-early-reports"
        ], element("layer-x-reports").checked);
    }

    function initializeMap() {
        if (!window.maplibregl?.Map) {
            throw new Error("The MapLibre renderer could not be loaded.");
        }

        const mapContainer = element("sentinel-map");
        map = new window.maplibregl.Map({
            container: mapContainer,
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

        const resizeMap = () => {
            if (!map) return;
            window.requestAnimationFrame(() => map?.resize());
        };
        const mapResizeObserver = "ResizeObserver" in window
            ? new ResizeObserver(resizeMap)
            : null;
        mapResizeObserver?.observe(mapContainer);
        window.addEventListener("load", resizeMap, { once: true });
        window.addEventListener("orientationchange", () => {
            window.setTimeout(resizeMap, 120);
            window.setTimeout(resizeMap, 420);
        });
        window.visualViewport?.addEventListener("resize", resizeMap);

        const handleFullscreenChange = () => {
            const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
            const fullscreen = fullscreenElement === element("sentinel-map");
            element("sentinel-map").classList.toggle("is-map-fullscreen", fullscreen);
            if (fullscreen) map.disableCooperativeGestures?.();
            else map.enableCooperativeGestures?.();
            window.setTimeout(() => map.resize(), 80);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

        element("fullscreen-detail-toggle")?.addEventListener("click", event => {
            const panel = event.currentTarget.closest(".fullscreen-event-panel");
            const collapsed = panel.classList.toggle("is-collapsed");
            event.currentTarget.textContent = collapsed ? "Expand" : "Minimize";
            event.currentTarget.setAttribute("aria-expanded", String(!collapsed));
        });

        map.on("load", () => {
            addIntelligenceLayers();
            mapReady = true;
            element("sentinel-map").dataset.mapReady = "true";
            resizeMap();
            updateMapData();
            loadEnvironmentalLayers().catch(error => console.warn("Environmental map layers unavailable", error));
            loadEarlyReportLayer().catch(error => console.warn("Social Media Early Reports layer unavailable", error));
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
        const selectedHours = hours === "all"
            ? window.SentinelData.mapRetentionHours
            : Math.min(Number(hours), window.SentinelData.mapRetentionHours);
        const threshold = Date.now() - selectedHours * 60 * 60 * 1000;

        filteredEvents = allEvents.filter(event => {
            if (type !== "all" && event.type !== type) return false;
            if (threat !== "all" && event.threat_level !== threat) return false;
            if (minimumConfidence && (event.confidence === null || event.confidence < minimumConfidence)) return false;
            const timestamp = Date.parse(event.timestamp || "");
            if (!Number.isFinite(timestamp) || timestamp < threshold) return false;
            return true;
        });
    }

    function updateMapData() {
        filterEvents();
        eventIndex = new Map();
        coordinateCounts = new Map();
        filteredEvents.forEach(event => {
            const key = `${event.latitude.toFixed(4)},${event.longitude.toFixed(4)}`;
            coordinateCounts.set(key, (coordinateCounts.get(key) || 0) + 1);
        });

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
        updateMapCount();
    }

    function updateMapCount() {
        const counts = [
            `${filteredEvents.length.toLocaleString()} intelligence`,
            `${environmentalCount.toLocaleString()} environmental`,
            `${earlyReportCount.toLocaleString()} X reports`
        ];
        element("map-count").textContent =
            filteredEvents.length || environmentalCount || earlyReportCount
                ? counts.join(" · ")
                : "No signals match the active filters";
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
        return window.SentinelData.cleanText(event.source || "Sentinel Grid", 180);
    }

    function aircraftValue(event, ...names) {
        for (const name of names) {
            const value = event.aircraft?.[name] ?? event[name];
            if (value !== null && value !== undefined && value !== "") return value;
        }
        return null;
    }

    function interpretationText(event) {
        const interpretations = {
            aircraft: "This aircraft was explicitly classified as military by the published data. The observation shows reported activity, not hostile intent.",
            conflict: "This is a conflict-related report associated with this area. The marker may represent a regional or country-level reference rather than an exact incident site.",
            news: "This is an open-source report associated with this geographic area. The marker provides reporting context and is not independent confirmation of an event at the exact pin.",
            satellite: "This is an Earth-observation or natural-hazard signal plotted from coordinates supplied by the source.",
            earthquake: "This marker is a USGS seismic observation. Magnitude describes measured ground motion; the marker is the reported epicenter.",
            volcano: "This marker represents a volcano report at the known volcano location. It does not imply that the entire surrounding area is erupting.",
            weather: "This shaded boundary is a NOAA alert area. Conditions and impacts can vary inside the polygon; follow local official guidance.",
            wildfire: "This is a reported wildfire incident. The marker identifies the supplied incident point, not the complete fire perimeter.",
            prescribed_fire: "This is a prescribed or controlled burn identified by the source. It is intentionally managed and is not classified as a wildfire emergency.",
            military_exercise: "This record explicitly describes a military or training exercise. It indicates reported activity, not hostile action.",
            cyber: "This is a cyber intelligence record. Geographic placement, when present, generally represents an affected or reporting region rather than infrastructure coordinates."
        };
        return interpretations[event.type] || "This marker represents the geographic context supplied with the source record; exact location precision was not provided.";
    }

    function coordinateContext(event) {
        const key = `${event.latitude.toFixed(4)},${event.longitude.toFixed(4)}`;
        const count = coordinateCounts.get(key) || 1;
        return count > 1 ?
            `Representative/shared point — ${count} visible events use these exact coordinates.` :
            "Reported point — the source does not specify whether this is exact or regional.";
    }

    function renderEventDetail(event) {
        const panel = element("event-detail");
        const heading = document.createElement("h3");
        const summary = document.createElement("p");
        const interpretation = document.createElement("section");
        const interpretationHeading = document.createElement("h4");
        const interpretationBody = document.createElement("p");
        const details = document.createElement("dl");

        heading.textContent = event.title;
        summary.textContent = event.description;
        interpretation.className = "interpretation-card";
        interpretationHeading.textContent = "How to interpret this signal";
        interpretationBody.textContent = interpretationText(event);
        interpretation.append(interpretationHeading, interpretationBody);
        appendDefinition(details, "Threat level", event.threat_level, `threat-${event.threat_level.toLowerCase()}`);
        appendDefinition(details, "Category", displayType(event.type));
        appendDefinition(details, "Confidence", event.confidence === null ? "Not reported" : `${event.confidence}%`);
        appendDefinition(details, "Observed", formatDate(event.timestamp));
        appendDefinition(details, "Source", sourceText(event));
        if (Number.isFinite(event.latitude) && Number.isFinite(event.longitude)) {
            appendDefinition(details, "Coordinates", `${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`);
            appendDefinition(details, "Location precision", coordinateContext(event));
        }
        else if (event.location) {
            appendDefinition(details, "Alert area", window.SentinelData.cleanText(event.location, 260));
        }
        if (event.type === "aircraft") {
            appendDefinition(details, "Callsign", aircraftValue(event, "callsign") || "Not reported");
            appendDefinition(details, "ICAO address", aircraftValue(event, "icao24", "icao") || "Not reported");
            appendDefinition(details, "Origin country", aircraftValue(event, "origin_country", "country") || "Not reported");
            const altitude = aircraftValue(event, "altitude");
            const velocity = aircraftValue(event, "velocity", "speed");
            const heading = aircraftValue(event, "heading", "track");
            appendDefinition(details, "Altitude", altitude === null ? "Not reported" : `${altitude} m`);
            appendDefinition(details, "Speed", velocity === null ? "Not reported" : `${velocity} m/s`);
            appendDefinition(details, "Heading", heading === null ? "Not reported" : `${heading}°`);
        }
        if (event.event_id) appendDefinition(details, "Event ID", event.event_id);
        if (isSourceReportedEvent(event)) {
            appendDefinition(details, "Verification status", "Source reported — not independently verified");
        }

        const sourceAction = document.createElement("button");
        sourceAction.type = "button";
        sourceAction.className = "event-source-action";
        sourceAction.textContent = "View associated sources";
        sourceAction.dataset.eventId = event.event_id;
        sourceAction.hidden = !event.event_id ||
            !window.SentinelSourceViewerController?.hasSourcesForEvent(event.event_id);
        sourceAction.addEventListener("click", () =>
            window.SentinelSourceViewerController?.openForEvent(event.event_id)
        );

        panel.replaceChildren(heading, summary, interpretation, details, sourceAction);
        syncFullscreenDetail(panel);
    }

    function syncFullscreenDetail(source) {
        const fullscreenDetail = element("fullscreen-event-detail");
        if (!fullscreenDetail) return;
        fullscreenDetail.replaceChildren(...[...source.children].map(child => child.cloneNode(true)));
        fullscreenDetail.querySelectorAll(".event-source-action").forEach(button => {
            button.addEventListener("click", () =>
                window.SentinelSourceViewerController?.openForEvent(button.dataset.eventId)
            );
        });
        fullscreenDetail.closest(".fullscreen-event-panel")?.classList.add("has-selection");
    }

    function renderEventGroup(events, totalCount) {
        const panel = element("event-detail");
        const heading = document.createElement("h3");
        const explanation = document.createElement("p");
        const list = document.createElement("div");

        heading.textContent = `${totalCount} signals in this group`;
        explanation.textContent = totalCount > events.length ?
            `Showing the first ${events.length} signals. Select one to inspect it.` :
            "Select a signal to inspect its source record and location context.";
        list.className = "cluster-list";

        events.forEach(event => {
            const button = document.createElement("button");
            const title = document.createElement("span");
            const metadata = document.createElement("small");
            button.type = "button";
            title.textContent = event.title;
            metadata.textContent = `${displayType(event.type)} · ${event.threat_level} · ${formatDate(event.timestamp)}`;
            button.append(title, metadata);
            button.addEventListener("click", () => renderEventDetail(event));
            list.appendChild(button);
        });

        panel.replaceChildren(heading, explanation, list);
        syncFullscreenDetail(panel);
        element("fullscreen-event-detail")?.querySelectorAll(".cluster-list button").forEach((button, index) => {
            button.addEventListener("click", () => renderEventDetail(events[index]));
        });
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

        allEvents = snapshot.events.filter(isMilitaryAircraft);
        populateFilters();
        renderHealth(snapshot);
        updateMapData();

        const state = snapshot.legacy ? "degraded" : snapshot.healthState.state;
        const message = snapshot.legacy ?
            "Operational with legacy publication metadata" :
            `${snapshot.healthState.message} Publication ${snapshot.manifest.publication_id}`;
        setStatus(message, state);
    }

    function ewsBaselineLabel(zScore) {
        if (zScore >= 2) return "Significantly above baseline";
        if (zScore >= 1) return "Above activity baseline";
        if (zScore <= -2) return "Significantly below baseline";
        if (zScore <= -1) return "Below activity baseline";
        return "Near activity baseline";
    }

    async function refreshEws() {
        const widget = element("ews-widget");
        try {
            const state = await client.fetchJSON("ews_state.json");
            const level = Number(state.level);
            const count = Number(state.concurrent_count);
            const zScore = Number(state.z_score);
            if (!Number.isInteger(level) || level < 0 || level > 4 || !Number.isFinite(count) || !Number.isFinite(zScore)) {
                throw new Error("Invalid EWS state");
            }

            widget.className = `metric-ews ews-level-${level}`;
            element("ews-level").textContent = `LEVEL ${level}`;
            element("ews-context").textContent = `${count.toLocaleString()} concurrent · ${ewsBaselineLabel(zScore)}`;
            widget.title = `Early Warning System: level ${level}; z-score ${zScore.toFixed(2)}; updated ${formatDate(state.as_of || state.last_checked)}. Supporting anomaly indicator only.`;
        }
        catch (error) {
            console.warn("EWS state unavailable", error);
            widget.className = "metric-ews is-error";
            element("ews-level").textContent = "UNAVAILABLE";
            element("ews-context").textContent = "Sentinel map remains operational";
        }
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

        ["layer-intelligence", "layer-earthquakes", "layer-volcanoes", "layer-weather", "layer-x-reports"].forEach(id => {
            element(id).addEventListener("change", applyLayerVisibility);
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

    function clearSourceHighlight(mapInstance = map, ready = mapReady) {
        if (!mapInstance || !ready || !highlightedEventId) return;
        try {
            mapInstance.setFeatureState(
                { source: "sentinel-events", id: highlightedEventId },
                { sourceHighlight: false }
            );
        }
        catch {
            // The source may have been replaced during a publication refresh.
        }
        highlightedEventId = null;
    }

    function locateSourceEvent(
        eventId,
        mapInstance = map,
        index = eventIndex,
        ready = mapReady,
        render = true
    ) {
        const safeId = String(eventId || "");
        const event = index.get(safeId);
        if (!mapInstance || !ready || !event) return false;
        clearSourceHighlight(mapInstance, ready);
        highlightedEventId = safeId;
        mapInstance.setFeatureState(
            { source: "sentinel-events", id: safeId },
            { sourceHighlight: true }
        );
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        mapInstance.easeTo({
            center: [event.longitude, event.latitude],
            zoom: Math.max(mapInstance.getZoom(), 8),
            duration: reducedMotion ? 0 : 450
        });
        if (render) renderEventDetail(event);
        return true;
    }

    window.SentinelMapBridge = Object.freeze({
        hasEvent(eventId) {
            return eventIndex.has(String(eventId || ""));
        },
        locateEvent: locateSourceEvent,
        clearHighlight: clearSourceHighlight,
        diagnostics() {
            return { mapReady, eventCount: eventIndex.size, highlightedEventId };
        }
    });
    window.SentinelMapAssociation = Object.freeze({
        locateSourceEvent,
        clearSourceHighlight,
        isSourceReported: isSourceReportedEvent
    });

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
        refreshEws();
        window.setInterval(() => {
            if (document.visibilityState === "visible") {
                refresh();
                refreshEws();
                updateMapData();
                refreshEnvironmentalRetention();
                refreshEarlyReportLayer().catch(error =>
                    console.warn("X report refresh failed; prior generation retained", error)
                );
            }
        }, DATA_REFRESH_MS);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                map?.resize();
                refresh();
                refreshEarlyReportLayer().catch(error =>
                    console.warn("X report refresh failed; prior generation retained", error)
                );
            }
        });
    });
}());

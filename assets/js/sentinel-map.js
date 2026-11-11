(function () {
    "use strict";

    const DATA_REFRESH_MS = 5 * 60 * 1000;
    const INITIAL_CENTER = [0, 20];
    const INITIAL_ZOOM = 2;
    const THREAT_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
    const MAJOR_CITIES = [
        ["New York", -74.006, 40.7128], ["Los Angeles", -118.2437, 34.0522], ["Mexico City", -99.1332, 19.4326],
        ["São Paulo", -46.6333, -23.5505], ["Buenos Aires", -58.3816, -34.6037], ["London", -0.1276, 51.5072],
        ["Paris", 2.3522, 48.8566], ["Berlin", 13.405, 52.52], ["Moscow", 37.6173, 55.7558],
        ["Istanbul", 28.9784, 41.0082], ["Cairo", 31.2357, 30.0444], ["Lagos", 3.3792, 6.5244],
        ["Nairobi", 36.8219, -1.2921], ["Johannesburg", 28.0473, -26.2041], ["Dubai", 55.2708, 25.2048],
        ["Mumbai", 72.8777, 19.076], ["Delhi", 77.1025, 28.7041], ["Beijing", 116.4074, 39.9042],
        ["Shanghai", 121.4737, 31.2304], ["Tokyo", 139.6917, 35.6895], ["Seoul", 126.978, 37.5665],
        ["Singapore", 103.8198, 1.3521], ["Jakarta", 106.8456, -6.2088], ["Sydney", 151.2093, -33.8688],
        ["Melbourne", 144.9631, -37.8136], ["Perth", 115.8575, -31.9505], ["Toronto", -79.3832, 43.6532],
        ["Chicago", -87.6298, 41.8781], ["Washington", -77.0369, 38.9072], ["San Francisco", -122.4194, 37.7749],
        ["Madrid", -3.7038, 40.4168], ["Rome", 12.4964, 41.9028], ["Kyiv", 30.5234, 50.4501],
        ["Tehran", 51.389, 35.6892], ["Baghdad", 44.3661, 33.3152], ["Riyadh", 46.6753, 24.7136],
        ["Karachi", 67.0011, 24.8607], ["Bangkok", 100.5018, 13.7563], ["Manila", 120.9842, 14.5995],
        ["Lima", -77.0428, -12.0464], ["Bogotá", -74.0721, 4.711], ["Santiago", -70.6693, -33.4489]
    ];
    const adapter = window.SentinelGodsEyeAdapter || null;
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
    const setText = (id, value) => {
        const node = element(id);
        if (node) node.textContent = value;
    };

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

    function getEventCategory(event) {
        if (!event) return "intelligence";
        if (adapter) {
            const normalized = adapter.normalizeEvent(event);
            if (normalized && normalized.category) return normalized.category;
        }
        return String(event.category || event.type || "intelligence").toLowerCase();
    }

    function symbolType(value) {
        const type = String(value || "news").toLowerCase();
        const aliases = {
            conflict: "conflict",
            cyber: "cyber",
            cyber_activity: "cyber",
            earthquake: "earthquake",
            humanitarian: "news",
            intelligence: "news",
            internet_outage: "internet_outage",
            gps_jamming: "gps_jamming",
            maritime: "maritime",
            naval_activity: "maritime",
            military_aircraft: "aircraft",
            military_exercise: "military_exercise",
            air_activity: "news",
            airspace_incident: "news",
            border_incident: "conflict",
            drone_activity: "conflict",
            missile_activity: "conflict",
            military_deployment: "military_exercise",
            mobilization: "military_exercise",
            nato_activity: "military_exercise",
            polish_military_activity: "military_exercise",
            russian_activity: "military_exercise",
            security_warning: "news",
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

    function plotClass(event) {
        const category = getEventCategory(event);
        if (category === "earthquake") return "earthquake";
        const rawSignals = [event?.type, event?.category, event?.classification, category]
            .filter(Boolean).join(" ").toLowerCase();
        const text = `${event?.title || ""} ${event?.description || ""}`;
        const warCategory = /(conflict|war|armed_conflict|insurgent|battle|military|europe_security|border_incident|drone_activity|missile_activity|military_deployment|mobilization|nato_activity|russian_activity|ground_activity)/i.test(rawSignals);
        const warText = /(armed conflict|war zone|military operation|military strike|airstrike|shelling|drone strike|missile strike|rocket attack|troops|invasion|frontline|combat|battlefield)/i.test(text);
        return warCategory || warText ? "war" : "news";
    }

    function isSourceReportedEvent(event) {
        return String(event?.location_status || "").toLowerCase() === "source_reported" ||
            ["source_reported", "unverified"].includes(String(event?.claim_status || "").toLowerCase());
    }

    function isHistoricalEvent(event) {
        return Boolean(event?.timestamp) && !window.SentinelData.isWithinRetentionWindow(event.timestamp);
    }

    function setStatus(message, state) {
        const status = element("ops-status");
        element("ops-status-text").textContent = message;
        status.className = `sentinel-status is-${state}`;
    }

    function setLoading(visible, message = "Building operational picture...") {
        const loading = element("map-loading");
        loading.lastChild.textContent = message;
        loading.classList.toggle("is-hidden", !visible);
    }

    function eventCoordinateKey(event) {
        return `${Number(event.latitude).toFixed(4)},${Number(event.longitude).toFixed(4)}`;
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
                        coordinates: [Number(event.longitude), Number(event.latitude)]
                    },
                    properties: {
                        map_id: mapId,
                        title: event.title,
                        type: getEventCategory(event),
                        plot_class: plotClass(event),
                        symbol_type: symbolType(getEventCategory(event)),
                        threat_level: event.threat_level,
                        confidence: event.confidence ?? 0,
                        timestamp: event.timestamp || "",
                        historical: isHistoricalEvent(event),
                        heading: Number(aircraftValue(event, "heading", "track")) || 0,
                        source_reported: isSourceReportedEvent(event)
                    }
                };
            })
        };
    }

    function cityFeatureCollection(events) {
        return {
            type: "FeatureCollection",
            features: MAJOR_CITIES.map(([name, longitude, latitude]) => {
                const nearbyEvents = events.filter(event => {
                    const latDistance = Number(event.latitude) - latitude;
                    const lonDistance = (Number(event.longitude) - longitude) * Math.cos(latitude * Math.PI / 180);
                    return Math.hypot(latDistance, lonDistance) <= 3.2;
                });
                return {
                    type: "Feature",
                    id: `city-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                    geometry: { type: "Point", coordinates: [longitude, latitude] },
                    properties: { name, event_count: nearbyEvents.length }
                };
            })
        };
    }

    function mapStyle() {
        return {
            version: 8,
            projection: { type: "mercator" },
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
        context.fillStyle = "rgba(6, 16, 18, 0)";
        context.shadowColor = "#e9fbff";
        context.shadowBlur = 7;
        context.beginPath();

        if (type === "wildfire" || type === "prescribed_fire") {
            context.font = '26px "Segoe UI Emoji", sans-serif';
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.shadowBlur = 4;
            context.fillText(String.fromCodePoint(0x1f525), 0, -1);
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
        else if (type === "cyber") {
            context.moveTo(-5, -13); context.lineTo(-14, 0); context.lineTo(-5, 13);
            context.moveTo(5, -13); context.lineTo(14, 0); context.lineTo(5, 13);
            context.moveTo(4, -16); context.lineTo(-4, 16);
        }
        else if (type === "maritime") {
            context.arc(0, -10, 3, 0, Math.PI * 2);
            context.moveTo(0, -7); context.lineTo(0, 14);
            context.moveTo(-12, -1); context.lineTo(12, -1);
            context.moveTo(-15, 5); context.quadraticCurveTo(-11, 16, 0, 16);
            context.quadraticCurveTo(11, 16, 15, 5);
        }
        else if (type === "gps_jamming") {
            context.arc(0, 0, 13, 0, Math.PI * 2);
            context.arc(0, 0, 5, 0, Math.PI * 2);
            context.moveTo(-17, 0); context.lineTo(17, 0);
            context.moveTo(0, -17); context.lineTo(0, 17);
            context.moveTo(-13, -13); context.lineTo(13, 13);
        }
        else if (type === "internet_outage") {
            context.arc(-12, -8, 4, 0, Math.PI * 2);
            context.arc(12, -8, 4, 0, Math.PI * 2);
            context.arc(0, 13, 4, 0, Math.PI * 2);
            context.moveTo(-8, -6); context.lineTo(-2, 9);
            context.moveTo(8, -6); context.lineTo(2, 9);
            context.moveTo(-5, 0); context.lineTo(5, 0);
        }
        else if (type === "military_exercise") {
            context.moveTo(-15, 8); context.lineTo(0, -12); context.lineTo(15, 8);
            context.moveTo(-10, 14); context.lineTo(0, 1); context.lineTo(10, 14);
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

    function addIntelligenceLayers() {
        map.addSource("sentinel-cities", {
            type: "geojson",
            data: cityFeatureCollection([])
        });
        map.addLayer({
            id: "major-city-glow",
            type: "circle",
            source: "sentinel-cities",
            paint: {
                "circle-radius": 13,
                "circle-color": ["case", [">", ["get", "event_count"], 0], "#ff294d", "#168cff"],
                "circle-opacity": 0.22,
                "circle-blur": 0.85
            }
        });
        map.addLayer({
            id: "major-city-lights",
            type: "circle",
            source: "sentinel-cities",
            paint: {
                "circle-radius": 3.2,
                "circle-color": ["case", [">", ["get", "event_count"], 0], "#ff294d", "#37a7ff"],
                "circle-stroke-color": "#071321",
                "circle-stroke-width": 1
            }
        });
        map.addLayer({
            id: "major-city-hit",
            type: "circle",
            source: "sentinel-cities",
            paint: {
                "circle-radius": 14,
                "circle-color": "rgba(0,0,0,0)",
                "circle-opacity": 0
            }
        });
        if (!map.hasImage("military-aircraft")) {
            map.addImage("military-aircraft", createAircraftIcon(), { pixelRatio: 2 });
        }
        ["conflict", "cyber", "news", "satellite", "maritime", "gps_jamming", "internet_outage", "wildfire", "prescribed_fire", "military_exercise", "earthquake", "volcano", "weather"].forEach(type => {
            if (!map.hasImage(`marker-${type}`)) map.addImage(`marker-${type}`, createCategoryIcon(type), { pixelRatio: 2 });
        });

        map.addSource("sentinel-events", {
            type: "geojson",
            data: featureCollection([]),
            // Every published event stays an individual normal-sized point.
            // Coincident records are grouped in the drawer after selection.
            cluster: false
        });

        map.addLayer({
            id: "event-glow",
            type: "circle",
            source: "sentinel-events",
            filter: ["all", ["!", ["has", "point_count"]], ["!", ["in", ["get", "type"], ["literal", ["aircraft", "military_aircraft"]]]]],
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 1.5, 4, 8, 9],
                "circle-color": ["case", ["==", ["get", "plot_class"], "war"], "#ff294d", ["==", ["get", "plot_class"], "earthquake"], "#b56cff", "#31d48a"],
                "circle-opacity": 0.09,
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
            type: "circle",
            source: "sentinel-events",
            filter: ["all", ["!", ["has", "point_count"]], ["!", ["in", ["get", "type"], ["literal", ["aircraft", "military_aircraft"]]]]],
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 1.5, 2.1, 4, 3.1, 8, 5.5],
                "circle-color": ["case", ["==", ["get", "plot_class"], "war"], "#ff294d", ["==", ["get", "plot_class"], "earthquake"], "#b56cff", "#31d48a"],
                "circle-opacity": 0.96,
                "circle-stroke-color": "#061012",
                "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 1.5, 0.75, 8, 2],
                "circle-stroke-opacity": 0.95
            }
        });

        map.addLayer({
            id: "event-glyphs",
            type: "symbol",
            source: "sentinel-events",
            filter: ["all", ["!", ["has", "point_count"]], ["!", ["in", ["get", "type"], ["literal", ["aircraft", "military_aircraft"]]]]],
            layout: {
                "icon-image": ["concat", "marker-", ["get", "symbol_type"]],
                "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.28, 8, 0.46],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "icon-padding": 0,
                "icon-opacity": 0
            }
        });

        map.addLayer({
            id: "military-aircraft-glow",
            type: "circle",
            source: "sentinel-events",
            filter: ["all", ["!", ["has", "point_count"]], ["in", ["get", "type"], ["literal", ["aircraft", "military_aircraft"]]]],
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 1.5, 5, 8, 10],
                "circle-color": "#ff294d",
                "circle-opacity": 0.1,
                "circle-blur": 0.7
            }
        });

        map.addLayer({
            id: "military-aircraft",
            type: "symbol",
            source: "sentinel-events",
            filter: ["in", ["get", "type"], ["literal", ["aircraft", "military_aircraft"]]],
            layout: {
                "icon-image": "military-aircraft",
                "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.45, 8, 0.7],
                "icon-rotate": ["coalesce", ["to-number", ["get", "heading"]], 0],
                "icon-rotation-alignment": "map",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "icon-opacity": 0
            }
        });

        // Keep the visual signal compact, but give mouse and touch users a
        // dependable target. This layer is intentionally transparent and sits
        // above the rendered event layers; it does not change event geometry.
        map.addLayer({
            id: "event-hit",
            type: "circle",
            source: "sentinel-events",
            filter: ["!", ["has", "point_count"]],
            paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 1.5, 12, 8, 16],
                "circle-color": "rgba(0,0,0,0)",
                "circle-opacity": 0
            }
        });

        const selectRenderedEvent = event => {
            const feature = event.features?.[0];
            if (!feature) return;
            selectEventById(feature.properties?.map_id);
        };

        map.on("click", "events", selectRenderedEvent);
        map.on("click", "event-glyphs", selectRenderedEvent);
        map.on("click", "military-aircraft", selectRenderedEvent);
        map.on("click", "event-hit", selectRenderedEvent);

        ["event-hit", "events", "event-glyphs", "military-aircraft"].forEach(layer => {
            map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        });
        ["major-city-hit", "major-city-lights", "major-city-glow"].forEach(layer => {
            map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        });
        map.on("click", "major-city-hit", event => {
            const city = event.features?.[0];
            if (!city) return;
            const [longitude, latitude] = city.geometry.coordinates;
            const events = filteredEvents.filter(item => {
                const latDistance = Number(item.latitude) - latitude;
                const lonDistance = (Number(item.longitude) - longitude) * Math.cos(latitude * Math.PI / 180);
                return Math.hypot(latDistance, lonDistance) <= 3.2;
            });
            renderEventGroup(events, events.length, city.properties?.name || "Selected city");
        });

        syncEventHitOverlay();
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
            window.SentinelData.isWithinRetentionWindow(event.timestamp) &&
            !isExpiredWeatherEvent(event) &&
            !isWeatherTestMessage(event)
        );
    }

    function isExpiredWeatherEvent(event, now = Date.now()) {
        if (event.type !== "weather") return false;
        const expiration = Date.parse(event.details?.ends || event.details?.expires || "");
        return Number.isFinite(expiration) && expiration <= now;
    }

    function isWeatherTestMessage(event) {
        if (event.type !== "weather") return false;
        const title = String(event.title || "").trim().toLowerCase();
        return ["test message", "required weekly test", "required monthly test"].includes(title);
    }

    function weatherColorExpression() {
        return [
            "match", ["get", "severity"],
            "CRITICAL", "#ff174f",
            "HIGH", "#ff6b35",
            "MEDIUM", "#ffd400",
            "LOW", "#00ddff",
            "#7f98a0"
        ];
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

    function addEnvironmentalPointLayer(sourceId, layerId, events, icon) {
        map.addSource(sourceId, {
            type: "geojson",
            data: pointFeatures(events),
            cluster: false
        });
        const pointLayer = { id: layerId, type: "symbol", source: sourceId, layout: { "icon-image": icon, "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.48, 8, 0.85], "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-padding": 0 } };
        map.addLayer(pointLayer);
        map.on("click", layerId, click => {
            const selected = disasterIndex.get(String(click.features?.[0]?.properties?.map_id));
            if (selected) {
                showEventPopup(selected, click.lngLat);
                renderEventDetail(selected);
            }
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
            cluster: false
        });
        map.addLayer({
            id: "x-early-reports",
            type: "symbol",
            source: "x-early-reports-source",
            layout: {
                "icon-image": "x-early-report-pinpoint",
                "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.16, 8, 0.25],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "icon-padding": 0
            }
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
        ["x-early-reports"].forEach(layerId => {
            map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
        });
        applyLayerVisibility();
        updateMapCount();
    }

    async function loadEnvironmentalLayers(options = {}) {
        const files = ["earthquakes.json", "volcanoes.json", "weather.json"];
        const results = await Promise.allSettled(files.map(file => client.fetchJSON(file, null, Boolean(options.refreshOnly))));
        const [earthquakes, volcanoes, weather] = results.map(result => result.status === "fulfilled" && Array.isArray(result.value) ? result.value.map(normalizeDisasterEvent) : []);
        if (options.refreshOnly) {
            if (results[0].status === "fulfilled") environmentalEvents.earthquakes = earthquakes;
            if (results[1].status === "fulfilled") environmentalEvents.volcanoes = volcanoes;
            if (results[2].status === "fulfilled") environmentalEvents.weather = weather;
            refreshEnvironmentalRetention();
            element("sentinel-map").dataset.weatherRefreshedAt = new Date().toISOString();
            return;
        }
        environmentalEvents = { earthquakes, volcanoes, weather };
        element("sentinel-map").dataset.weatherRefreshedAt = new Date().toISOString();
        const recentEarthquakes = retainRecentEvents(earthquakes);
        const recentVolcanoes = retainRecentEvents(volcanoes);
        const recentWeather = retainRecentEvents(weather);

        addEnvironmentalPointLayer("earthquake-source", "earthquakes", recentEarthquakes, "marker-earthquake");
        addEnvironmentalPointLayer("volcano-source", "volcanoes", recentVolcanoes, "marker-volcano");

        const weatherFeatures = recentWeather.map(event => {
            const geometry = validPolygonGeometry(event);
            if (!geometry) return null;
            disasterIndex.set(event.event_id, event);
            return { type: "Feature", geometry, properties: { map_id: event.event_id, title: event.title, severity: event.threat_level, expires: event.details?.ends || event.details?.expires || "" } };
        }).filter(Boolean);
        environmentalCount = recentEarthquakes.filter(event => Number.isFinite(event.latitude) && Number.isFinite(event.longitude)).length +
            recentVolcanoes.filter(event => Number.isFinite(event.latitude) && Number.isFinite(event.longitude)).length + weatherFeatures.length;
        map.addSource("weather-source", { type: "geojson", data: { type: "FeatureCollection", features: weatherFeatures } });
        map.addLayer({ id: "weather-fill", type: "fill", source: "weather-source", paint: { "fill-color": weatherColorExpression(), "fill-opacity": ["match", ["get", "severity"], "CRITICAL", 0.28, "HIGH", 0.22, "MEDIUM", 0.17, 0.12] } });
        map.addLayer({ id: "weather-line", type: "line", source: "weather-source", paint: { "line-color": weatherColorExpression(), "line-width": ["match", ["get", "severity"], "CRITICAL", 3, "HIGH", 2.5, 2], "line-dasharray": [2, 2] } });
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
            const expires = Date.parse(selected.details?.ends || selected.details?.expires || "");
            const remaining = Number.isFinite(expires) ? Math.max(0, Math.ceil((expires - Date.now()) / 60000)) : null;
            location.textContent = `${selected.threat_level} · ${selected.location || "Weather alert area"}${remaining === null ? "" : ` · ${remaining} min remaining`}`;
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
                properties: { map_id: event.event_id, title: event.title, severity: event.threat_level, expires: event.details?.ends || event.details?.expires || "" }
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

    function showEventPopup(event, lngLat) {
        if (!window.maplibregl?.Popup || !map || !event || !lngLat) return;
        const content = document.createElement("article");
        content.className = "sentinel-popup";
        const title = document.createElement("h3");
        title.textContent = event.title || "Intelligence event";
        const meta = document.createElement("p");
        meta.className = "sentinel-popup-meta";
        meta.textContent = [displayType(getEventCategory(event)), event.threat_level || "UNKNOWN", formatDate(event.timestamp)]
            .filter(Boolean).join(" · ");
        const location = document.createElement("p");
        location.textContent = event.location || (Number.isFinite(event.latitude) && Number.isFinite(event.longitude)
            ? `${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}` : "Location not reported");
        const source = document.createElement("p");
        source.textContent = `Source: ${sourceText(event)}`;
        content.append(title, meta, location, source);
        const link = event.source_url || event.url || event.link;
        if (link) {
            const anchor = document.createElement("a");
            anchor.href = link;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            anchor.textContent = "Open original report";
            content.append(anchor);
        }
        map.popup?.remove();
        map.popup = new window.maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 12, maxWidth: "390px" })
            .setLngLat(lngLat)
            .setDOMContent(content)
            .addTo(map);
    }

    function applyLayerVisibility() {
        setLayersVisible(["event-glow", "event-hit", "events", "event-glyphs", "source-reported-halo", "association-highlight", "military-aircraft-glow", "military-aircraft"], true);
        setLayersVisible(["earthquakes", "volcanoes", "weather-fill", "weather-line", "x-early-reports"], true);
        updateMapData();
    }

    function initializeMap() {
        if (map) return;
        if (!window.maplibregl?.Map) {
            throw new Error("The MapLibre renderer could not be loaded.");
        }

        const mapContainer = element("sentinel-map");
        map = new window.maplibregl.Map({
            container: mapContainer,
            style: mapStyle(),
            center: INITIAL_CENTER,
            zoom: INITIAL_ZOOM,
            pitch: 0,
            bearing: 0,
            minZoom: 1.5,
            maxZoom: 16,
            renderWorldCopies: true,
            attributionControl: true,
            fadeDuration: 0
        });

        map.addControl(new window.maplibregl.NavigationControl({ visualizePitch: false }), "top-left");
        map.addControl(new window.maplibregl.FullscreenControl(), "top-left");
        map.addControl(new window.maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
        map.on("move", syncEventHitOverlay);
        map.on("zoom", syncEventHitOverlay);
        map.on("rotate", syncEventHitOverlay);
        map.on("resize", syncEventHitOverlay);

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
            window.setTimeout(() => map.resize(), 80);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

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

    function getVisibleCategorySet() {
        const categorySet = new Set();
        if (!element("layer-intelligence")) {
            allEvents.forEach(event => categorySet.add(getEventCategory(event)));
            return categorySet;
        }
        const layerChecks = [
            ["layer-intelligence", ["intelligence", "news", "reddit_report", "x_report"]],
            ["layer-conflict", ["conflict", "military_exercise"]],
            ["layer-cyber", ["cyber"]],
            ["layer-aircraft", ["aircraft"]],
            ["layer-military-aircraft", ["military_aircraft", "military_exercise"]],
            ["layer-maritime", ["maritime"]],
            ["layer-satellites", ["satellite"]],
            ["layer-earthquakes", ["earthquake"]],
            ["layer-volcanoes", ["volcano"]],
            ["layer-weather", ["weather", "weather_alert", "wildfire", "prescribed_fire"]],
            ["layer-solar", ["solar"]],
            ["layer-humanitarian", ["humanitarian"]],
            ["layer-gps-jamming", ["gps_jamming"]],
            ["layer-internet-outages", ["internet_outage"]]
        ];

        layerChecks.forEach(([id, categories]) => {
            if (element(id)?.checked) {
                categories.forEach(category => categorySet.add(category));
            }
        });

        return categorySet;
    }

    function filterEvents() {
        const type = element("filter-type")?.value || "all";
        const threat = element("filter-threat")?.value || "all";
        const minimumConfidence = Number(element("filter-confidence")?.value || 0);
        const hours = element("filter-time")?.value || "all";
        const selectedHours = hours === "all" ? null : Number(hours);
        const threshold = Number.isFinite(selectedHours) ? Date.now() - selectedHours * 60 * 60 * 1000 : null;
        const visibleCategories = getVisibleCategorySet();
        const europeLayerChecks = [
            ["layer-europe-nato", "nato_activity"],
            ["layer-europe-russia", "russian_activity"],
            ["layer-europe-flank", "eastern_flank"],
            ["layer-europe-ukraine", "ukraine_war"],
            ["layer-europe-air", "air_activity"],
            ["layer-europe-naval", "naval_activity"],
            ["layer-europe-missile", "missile_drone"],
            ["layer-europe-exercises", "military_exercise"],
            ["layer-europe-warnings", "security_warning"],
            ["layer-europe-reddit", "reddit_osint"]
        ];
        const enabledEuropeLayers = new Set(europeLayerChecks.filter(([id]) => element(id)?.checked).map(([, layer]) => layer));

        filteredEvents = allEvents.filter(event => {
            const category = getEventCategory(event);
            const raw = adapter?.normalizeEvent(event)?.metadata?.raw || event;
            const europeLayers = Array.isArray(raw.europe_layers) ? raw.europe_layers : [];
            if (europeLayers.length && element("layer-europe-nato")) {
                if (!europeLayers.some(layer => enabledEuropeLayers.has(layer))) return false;
            } else if (!visibleCategories.has(category)) return false;
            if (type !== "all" && category !== type) return false;
            if (threat !== "all" && (event.threat_level || "UNKNOWN") !== threat) return false;
            if (minimumConfidence && (event.confidence === null || event.confidence < minimumConfidence)) return false;
            const timestamp = Date.parse(event.timestamp || "");
            if (!Number.isFinite(timestamp) || (threshold !== null && timestamp < threshold)) return false;
            return true;
        });
        element("sentinel-map").dataset.filteredEvents = String(filteredEvents.length);
    }

    function updateMapData() {
        filterEvents();
        eventIndex = new Map();
        coordinateCounts = new Map();
        filteredEvents.forEach(event => {
            const key = eventCoordinateKey(event);
            coordinateCounts.set(key, (coordinateCounts.get(key) || 0) + 1);
        });
        element("sentinel-map").dataset.filteredEvents = String(filteredEvents.length);

        if (mapReady) {
            map.getSource("sentinel-events").setData(featureCollection(filteredEvents));
            map.getSource("sentinel-cities")?.setData(cityFeatureCollection(filteredEvents));
            map.triggerRepaint();
            syncEventHitOverlay();
            window.setTimeout(() => {
                element("sentinel-map").dataset.renderedFeatures = String(
                    map.querySourceFeatures("sentinel-events").length
                );
                const visibleIds = new Set();
                let clusteredVisible = 0;
                map.queryRenderedFeatures({ layers: ["event-hit", "events", "event-glyphs", "military-aircraft"] })
                    .forEach(feature => {
                        const count = Number(feature.properties?.point_count);
                        if (Number.isFinite(count) && count > 0) clusteredVisible += count;
                        else if (feature.properties?.map_id) visibleIds.add(String(feature.properties.map_id));
                    });
                element("sentinel-map").dataset.visibleEvents = String(visibleIds.size + clusteredVisible);
                setLoading(false);
                syncEventHitOverlay();
            }, 350);
        }

        setText("ops-mapped", filteredEvents.length.toLocaleString());
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
        if (!element("filter-type")) return;
        const types = Array.from(new Set(allEvents.map(event => getEventCategory(event)))).sort();
        const threats = Array.from(new Set(allEvents.map(event => String(event.threat_level || "UNKNOWN").toUpperCase())))
            .sort((a, b) => THREAT_ORDER.indexOf(a) - THREAT_ORDER.indexOf(b));
        populateSelect(element("filter-type"), types, "All event types", displayType);
        populateSelect(element("filter-threat"), threats, "All threat levels");
        updateTimeFilterOptions();
    }

    function updateTimeFilterOptions() {
        const select = element("filter-time");
        if (!select) return;
        const timestamps = allEvents
            .map(event => Date.parse(event.timestamp || ""))
            .filter(timestamp => Number.isFinite(timestamp));
        const oldest = Math.min(...timestamps);
        Array.from(select.options).forEach(option => {
            const hours = Number(option.value);
            const supported = option.value === "all" || option.value === "24" || option.value === "48" ||
                (option.value === "168" && Number.isFinite(oldest) && oldest <= Date.now() - 168 * 60 * 60 * 1000);
            option.hidden = !supported;
        });
        if (select.selectedOptions[0]?.hidden) select.value = "all";
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

    function openEventDrawer() {
        const panel = element("event-panel");
        panel?.classList.add("is-open");
        panel?.setAttribute("aria-hidden", "false");
        element("event-list-toggle")?.setAttribute("aria-expanded", "true");
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
        appendDefinition(details, "Temporal status", isHistoricalEvent(event) ? "Historical publication record" : "Recent publication record");
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
        if (event.type === "weather") {
            const weather = event.details || {};
            appendDefinition(details, "Alert area", event.location || "Not reported");
            appendDefinition(details, "Expires", formatDate(weather.ends || weather.expires));
            if (weather.instruction) appendDefinition(details, "Protective action", window.SentinelData.cleanText(weather.instruction, 700));
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
        setText("event-drawer-title", "Selected event");
        openEventDrawer();
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

    function selectEventById(eventId) {
        const selectedId = String(eventId || "");
        const selectedEvent = eventIndex.get(selectedId);
        if (!selectedEvent) return false;

        // Group from the verified publication index rather than rendered
        // pixels, so overlapping records can never be lost to draw order.
        const selectedCoordinate = eventCoordinateKey(selectedEvent);
        const events = Array.from(eventIndex.values())
            .filter(item => eventCoordinateKey(item) === selectedCoordinate);

        if (events.length > 1) {
            renderEventGroup(events, events.length);
            const first = events[0];
            map.easeTo({
                center: [first.longitude, first.latitude],
                zoom: Math.min(8, Math.max(map.getZoom() + 2, 6)),
                duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420
            });
        }
        else {
            locateSourceEvent(selectedId);
        }
        return true;
    }

    function syncEventHitOverlay() {
        const overlay = element("sentinel-event-hit-overlay");
        if (!overlay || !map || !mapReady) return;

        const width = map.getContainer().clientWidth;
        const height = map.getContainer().clientHeight;
        const visibleUnclusteredIds = new Set();
        try {
            map.querySourceFeatures("sentinel-events")
                .filter(feature => !feature.properties?.point_count)
                .forEach(feature => {
                    const id = feature.properties?.map_id;
                    if (id) visibleUnclusteredIds.add(String(id));
                });
        }
        catch {
            // Source tiles can be unavailable briefly during a publication refresh.
        }
        const sourceReadyForIndividualEvents = visibleUnclusteredIds.size > 0;
        const activeIds = new Set();

        eventIndex.forEach((event, eventId) => {
            let button = overlay.querySelector(`[data-event-id="${CSS.escape(String(eventId))}"]`);
            if (!button) {
                button = document.createElement("button");
                button.type = "button";
                button.className = "sentinel-event-hit";
                button.dataset.eventId = String(eventId);
                button.addEventListener("click", click => {
                    click.preventDefault();
                    click.stopPropagation();
                    selectEventById(eventId);
                });
                overlay.appendChild(button);
            }

            button.setAttribute("aria-label", `Open event: ${event.title || "Published intelligence event"}`);
            button.title = event.title || "Published intelligence event";
            const point = map.project([event.longitude, event.latitude]);
            const visible = (sourceReadyForIndividualEvents
                ? visibleUnclusteredIds.has(String(eventId))
                : map.getZoom() > 4.05) &&
                point.x >= -20 && point.x <= width + 20 &&
                point.y >= -20 && point.y <= height + 20;
            button.hidden = !visible;
            if (visible) {
                button.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`;
                activeIds.add(String(eventId));
            }
        });

        overlay.querySelectorAll(".sentinel-event-hit").forEach(button => {
            if (!activeIds.has(button.dataset.eventId || "")) button.hidden = true;
        });
    }

    function renderEventGroup(events, totalCount, locationLabel = "Events at this map point") {
        const panel = element("event-detail");
        const heading = document.createElement("h3");
        const explanation = document.createElement("p");
        const list = document.createElement("div");

        heading.textContent = `${totalCount} signals in this group`;
        explanation.textContent = !events.length ?
            `${locationLabel} has no published event records in the current publication.` : totalCount > events.length ?
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
        setText("event-drawer-title", locationLabel);
        openEventDrawer();
        syncFullscreenDetail(panel);
        element("fullscreen-event-detail")?.querySelectorAll(".cluster-list button").forEach((button, index) => {
            button.addEventListener("click", () => renderEventDetail(events[index]));
        });
    }

    function renderHealth(snapshot) {
        const coverage = element("coverage-message");
        const sources = element("coverage-sources");
        if (!coverage || !sources) return;
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

        setText("ops-threat", String(summary.global_threat_level || summary.threat_level || "UNKNOWN"));
        setText("ops-total", Number(summary.total_events || snapshot.events.length).toLocaleString());
        setText("ops-critical", criticalEvents.length.toLocaleString());
        setText("ops-generated", formatDate(generated));

        allEvents = snapshot.events;
        element("event-feed-count").textContent = snapshot.events.length.toLocaleString();
        element("sentinel-map").dataset.loadedEvents = String(snapshot.events.length);
        element("sentinel-map").dataset.rejectedEvents = String(snapshot.invalidEventCount || 0);
        element("sentinel-map").dataset.feedState = snapshot.invalidEventCount
            ? "degraded"
            : snapshot.events.length ? "available" : "empty";
        element("sentinel-map").dataset.visibleEvents = "0";
        populateFilters();
        renderHealth(snapshot);
        updateMapData();

        const rejectedMessage = snapshot.invalidEventCount
            ? ` ${snapshot.invalidEventCount} records were rejected because they lacked valid map coordinates or IDs.`
            : "";
        const state = snapshot.legacy || snapshot.invalidEventCount ? "degraded" : snapshot.healthState.state;
        const healthReasons = snapshot.healthState.failedSources
            .slice(0, 4)
            .map(source => `${source.name || source.source || "source"}: ${source.status || "limited"}`)
            .join("; ");
        const statusNode = element("ops-status");
        if (statusNode) {
            statusNode.title = healthReasons
                ? `Coverage detail: ${healthReasons}`
                : "Coverage detail unavailable.";
        }
        const message = snapshot.legacy ?
            "Operational with legacy publication metadata" :
            `${snapshot.healthState.message} Publication ${snapshot.manifest.publication_id}.${rejectedMessage}`;
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
        if (!widget) return;
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
            element("sentinel-map").dataset.feedState = "error";
            if (!allEvents.length) {
                setLoading(false);
                element("map-count").textContent = "Intelligence data unavailable";
            }
        }
    }

    function bindControls() {
        const setEventDrawer = open => {
            const panel = element("event-panel");
            panel?.classList.toggle("is-open", open);
            panel?.setAttribute("aria-hidden", String(!open));
            element("event-list-toggle")?.setAttribute("aria-expanded", String(open));
        };
        element("event-list-toggle")?.addEventListener("click", () => {
            setEventDrawer(!element("event-panel")?.classList.contains("is-open"));
        });
        element("event-panel-close")?.addEventListener("click", () => setEventDrawer(false));
        element("event-panel")?.addEventListener("click", event => {
            if (event.target === element("event-panel")) setEventDrawer(false);
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
        if (render) {
            showEventPopup(event, [event.longitude, event.latitude]);
            renderEventDetail(event);
        }
        return true;
    }

    window.SentinelMapBridge = Object.freeze({
        hasEvent(eventId) {
            return eventIndex.has(String(eventId || ""));
        },
        locateEvent: locateSourceEvent,
        clearHighlight: clearSourceHighlight,
        diagnostics() {
            return {
                mapReady,
                eventCount: eventIndex.size,
                highlightedEventId,
                zoom: map?.getZoom() ?? null,
                eventCoordinates: Array.from(eventIndex, ([eventId, event]) => ({
                    eventId,
                    latitude: event.latitude,
                    longitude: event.longitude
                }))
            };
        },
        firstEventPoint() {
            if (!map || !mapReady) return null;
            for (const [eventId, event] of eventIndex) {
                const point = map.project([event.longitude, event.latitude]);
                if (point.x >= 0 && point.x <= map.getContainer().clientWidth &&
                    point.y >= 0 && point.y <= map.getContainer().clientHeight) {
                    return { x: point.x, y: point.y, eventId };
                }
            }
            return null;
        },
        firstCityPoint() {
            if (!map || !mapReady) return null;
            const feature = map.queryRenderedFeatures({ layers: ["major-city-hit"] })
                .find(item => Number(item.properties?.event_count || 0) === 0) ||
                map.queryRenderedFeatures({ layers: ["major-city-hit"] })[0];
            if (!feature?.geometry?.coordinates) return null;
            const point = map.project(feature.geometry.coordinates);
            return { x: point.x, y: point.y, name: feature.properties?.name || "City" };
        },
        projectEvent(eventId) {
            const event = eventIndex.get(String(eventId || ""));
            if (!map || !event) return null;
            const point = map.project([event.longitude, event.latitude]);
            return { x: point.x, y: point.y };
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
                loadEnvironmentalLayers({ refreshOnly: true }).catch(error =>
                    console.warn("Environmental refresh failed; prior data retained", error)
                );
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

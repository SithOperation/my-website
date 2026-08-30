(function () {
    "use strict";

    const DEFAULT_SEVERITY = "UNKNOWN";

    function toArray(value) {
        if (Array.isArray(value)) return value.filter(Boolean);
        if (typeof value === "string") return value.split(/[|,;]/).map(part => part.trim()).filter(Boolean);
        return [];
    }

    function normalizeSeverity(value) {
        const normalized = String(value || DEFAULT_SEVERITY).trim().toUpperCase();
        if (["CRITICAL", "SEVERE", "URGENT"].includes(normalized)) return "CRITICAL";
        if (["HIGH", "RED"].includes(normalized)) return "HIGH";
        if (["MEDIUM", "YELLOW", "MODERATE"].includes(normalized)) return "MEDIUM";
        if (["LOW", "GREEN", "MINOR"].includes(normalized)) return "LOW";
        return "UNKNOWN";
    }

    function normalizeCategory(rawType, rawCategory, rawClassification, titleText, descriptionText) {
        const text = `${titleText || ""} ${descriptionText || ""}`.toLowerCase();
        const candidates = [
            rawType,
            rawCategory,
            rawClassification,
            String(rawType || rawCategory || "").toLowerCase()
        ].filter(Boolean);

        const category = candidates
            .map(value => String(value).trim().toLowerCase())
            .find(value => value && value !== "null");

        if (category) {
            if (["aircraft", "aviation", "flight"].includes(category)) return "aircraft";
            if (["military_aircraft", "military-aviation"].includes(category)) return "military_aircraft";
            if (["conflict", "war", "armed_conflict", "insurgent", "battle"].includes(category)) return "conflict";
            if (["cyber", "cyber_event", "malware", "ransomware", "phishing", "threat"].includes(category)) return "cyber";
            if (["humanitarian", "disaster", "disaster_alert", "aid", "relief"].includes(category)) return "humanitarian";
            if (["maritime", "ship", "vessel", "naval", "sea"].includes(category)) return "maritime";
            if (["satellite", "space", "orbital", "space_weather"].includes(category)) return "satellite";
            if (["earthquake", "seismic"].includes(category)) return "earthquake";
            if (["volcano", "eruption"].includes(category)) return "volcano";
            if (["weather", "weather_alert", "tropical_cyclone", "storm", "flood", "hurricane"].includes(category)) return "weather";
            if (["solar", "space_weather", "geomagnetic"].includes(category)) return "solar";
            if (["outage", "internet_outage", "network_outage", "ioda"].includes(category)) return "internet_outage";
            if (["gps_jamming", "gpsjam", "jamming", "interference"].includes(category)) return "gps_jamming";
            if (["conflict_report"].includes(category)) return "conflict";
            if (["reddit_report", "x_report", "news", "breaking_news", "intelligence"].includes(category)) return "intelligence";
        }

        if (/(cyber|malware|ransomware|phishing|ddos|botnet|exploit)/i.test(text)) return "cyber";
        if (/(armed|conflict|rocket|shelling|drone|strike|battle|combat)/i.test(text)) return "conflict";
        if (/(military aircraft|fighter jet|air force|military aviation)/i.test(text)) return "military_aircraft";
        if (/(aircraft|plane|flight|helicopter|jet)/i.test(text)) return "aircraft";
        if (/(ship|maritime|naval|vessel|cargo|pirate|fishing)/i.test(text)) return "maritime";
        if (/(satellite|orbital|space|launch|debris)/i.test(text)) return "satellite";
        if (/(earthquake|seismic|quake)/i.test(text)) return "earthquake";
        if (/(volcano|eruption|lava)/i.test(text)) return "volcano";
        if (/(hurricane|storm|flood|tornado|weather|severe weather|blizzard)/i.test(text)) return "weather";
        if (/(solar|geomagnetic|space weather|sunspot)/i.test(text)) return "solar";
        if (/(internet|outage|network|connectivity)/i.test(text)) return "internet_outage";
        if (/(humanitarian|aid|refugee|evacuation)/i.test(text)) return "humanitarian";

        return String(rawType || rawCategory || "intelligence").toLowerCase() || "intelligence";
    }

    function normalizeEvent(rawEvent) {
        if (!rawEvent || typeof rawEvent !== "object") return null;

        const latitude = Number(rawEvent.latitude ?? rawEvent.lat ?? rawEvent.location?.latitude ?? rawEvent.coordinates?.lat ?? rawEvent.geo?.lat);
        const longitude = Number(rawEvent.longitude ?? rawEvent.lon ?? rawEvent.location?.longitude ?? rawEvent.coordinates?.lon ?? rawEvent.geo?.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        const title = String(rawEvent.title || rawEvent.name || "Intelligence event").trim();
        const description = String(rawEvent.description || rawEvent.summary || rawEvent.message || rawEvent.details || "No description available.").trim();
        const category = normalizeCategory(
            rawEvent.type,
            rawEvent.category,
            rawEvent.classification,
            title,
            description
        );
        const sourceList = toArray(rawEvent.source);
        const threatLevel = String(rawEvent.threat_level || rawEvent.priority || rawEvent.severity || rawEvent.level || DEFAULT_SEVERITY).trim().toUpperCase();
        const timestamp = rawEvent.timestamp || rawEvent.as_of || rawEvent.published || rawEvent.last_updated || rawEvent.created_at || new Date().toISOString();

        return {
            id: String(rawEvent.event_id || rawEvent.id || `${category}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`),
            type: category,
            category,
            title: title || "Intelligence event",
            description: description || "No description available.",
            latitude,
            longitude,
            timestamp,
            severity: normalizeSeverity(threatLevel),
            threat_level: normalizeSeverity(threatLevel),
            confidence: Number.isFinite(Number(rawEvent.confidence)) ? Number(rawEvent.confidence) : null,
            source: sourceList.length ? sourceList : ["Sentinel Grid"],
            url: rawEvent.url || "",
            metadata: {
                rawType: rawEvent.type || null,
                classification: rawEvent.classification || null,
                sourceList,
                sourceType: rawEvent.source_type || rawEvent.sourceType || null,
                priority: rawEvent.priority || null,
                priorityRaw: rawEvent.priority || null,
                tags: toArray(rawEvent.tags || rawEvent.labels),
                context: rawEvent.location || rawEvent.location_name || null,
                raw: rawEvent
            }
        };
    }

    function deduplicateEvents(events) {
        const byKey = new Map();
        events.forEach(event => {
            const key = [event.id, event.title, event.latitude, event.longitude, event.timestamp].join("|");
            if (!byKey.has(key)) byKey.set(key, event);
        });
        return [...byKey.values()];
    }

    function normalizeCollection(events) {
        if (!Array.isArray(events)) return [];
        return deduplicateEvents(events.map(normalizeEvent).filter(Boolean));
    }

    function buildLayerState(events, extras = {}) {
        const normalized = normalizeCollection(events || []);
        const extrasList = normalizeCollection(extras.earthquakes || []).concat(
            normalizeCollection(extras.volcanoes || []),
            normalizeCollection(extras.weather || []),
            normalizeCollection(extras.solar || []),
            normalizeCollection(extras.humanitarian || [])
        );
        const all = normalized.concat(extrasList);

        return {
            globalIntelligence: all.length > 0,
            conflict: all.some(event => ["conflict", "military", "war", "humanitarian"].includes(event.category)),
            cyber: all.some(event => ["cyber"].includes(event.category) || /(cyber|malware|ransomware|phishing|exploit)/i.test(`${event.title} ${event.description}`)),
            aircraft: all.some(event => ["aircraft"].includes(event.category) || /aircraft|flight|aviation/i.test(`${event.title} ${event.description}`)),
            militaryAircraft: all.some(event => ["aircraft"].includes(event.category) && /(military|fighter|air-defense|strike|jet)/i.test(`${event.title} ${event.description}`)),
            maritime: all.some(event => ["maritime"].includes(event.category) || /(ship|maritime|naval|cargo|vessel)/i.test(`${event.title} ${event.description}`)),
            satellites: all.some(event => ["satellite", "solar"].includes(event.category) || /(satellite|orbital|launch|space|debris)/i.test(`${event.title} ${event.description}`)),
            earthquakes: all.some(event => ["earthquake"].includes(event.category) || /(earthquake|seismic|quake)/i.test(`${event.title} ${event.description}`)),
            volcanoes: all.some(event => ["volcano"].includes(event.category) || /(volcano|eruption|lava)/i.test(`${event.title} ${event.description}`)),
            weather: all.some(event => ["weather"].includes(event.category) || /(weather|storm|flood|hurricane|blizzard|warning)/i.test(`${event.title} ${event.description}`)),
            solar: all.some(event => ["solar"].includes(event.category) || /(solar|geomagnetic|sunspot|space weather)/i.test(`${event.title} ${event.description}`)),
            humanitarian: all.some(event => ["humanitarian"].includes(event.category) || /(humanitarian|aid|refugee|evacuation|shelter)/i.test(`${event.title} ${event.description}`)),
            gpsJamming: all.some(event => ["gps_jamming"].includes(event.category) || /(gps|jamming|interference)/i.test(`${event.title} ${event.description}`)),
            internetOutages: all.some(event => ["internet_outage"].includes(event.category) || /(internet|outage|network outage|connectivity)/i.test(`${event.title} ${event.description}`))
        };
    }

    const layerConfiguration = [
        { key: "globalIntelligence", label: "Global intelligence events", defaultVisible: true },
        { key: "conflict", label: "Conflict events", defaultVisible: true },
        { key: "cyber", label: "Cyber events", defaultVisible: true },
        { key: "aircraft", label: "Aircraft", defaultVisible: true },
        { key: "militaryAircraft", label: "Military aircraft", defaultVisible: true },
        { key: "maritime", label: "Maritime", defaultVisible: true },
        { key: "satellites", label: "Satellites", defaultVisible: true },
        { key: "earthquakes", label: "Earthquakes", defaultVisible: true },
        { key: "volcanoes", label: "Volcanoes", defaultVisible: true },
        { key: "weather", label: "Weather / severe weather", defaultVisible: true },
        { key: "solar", label: "Solar / space weather", defaultVisible: true },
        { key: "humanitarian", label: "Humanitarian events", defaultVisible: true },
        { key: "gpsJamming", label: "GPS interference / jamming", defaultVisible: true },
        { key: "internetOutages", label: "Internet outages", defaultVisible: true }
    ];

    window.SentinelGodsEyeAdapter = Object.freeze({
        normalizeEvent,
        normalizeCollection,
        buildLayerState,
        layerConfiguration,
        normalizeSeverity,
        normalizeCategory,
        DEFAULT_SEVERITY
    });
}());

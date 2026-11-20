(function () {
    "use strict";

    const API_ROOT = window.__MONITOR_API_ROOT__ || "https://ddos-detector.newhorse62.workers.dev";
    const REFRESH_MS = 60 * 1000;
    const RADWARE_REFRESH_MS = 5 * 60 * 1000;
    const STALE_MS = 10 * 60 * 1000;
    const state = { records: [], filtered: [], responseAt: null, backendTimestamp: null, error: null, controller: null, refreshInFlight: false, signalHistory: [], lastSignalKey: null };
    const radwareState = { payload: null, error: null, inFlight: false };
    const downradarState = { disruptions: null, incidents: null, errors: [], inFlight: false };
    const RADWARE_CATEGORIES = [
        ["top_attackers", "radware-top-attackers"],
        ["top_attacked", "radware-top-attacked"],
        ["network_vectors", "radware-network-vectors"],
        ["application_violations", "radware-application-violations"],
        ["scanned_udp_ports", "radware-scanned-udp-ports"],
        ["scanned_tcp_ports", "radware-scanned-tcp-ports"]
    ];
    const $ = id => document.getElementById(id);
    const text = value => String(value ?? "").replace(/\s+/g, " ").trim();
    const array = value => Array.isArray(value) ? value.filter(Boolean).map(text) : [];
    const validDate = value => { const time = typeof value === "number" ? value : Date.parse(String(value || "")); return Number.isFinite(time) ? time : null; };
    const first = (...values) => values.map(text).find(Boolean) || "Unknown";

    function normalizeRecord(raw) {
        if (!raw || typeof raw !== "object") return null;
        const id = text(raw.id || raw.outageId || raw.outage_id);
        if (!id) return null;
        const start = raw.startDate || raw.start_time || raw.startTime || raw.startedAt || null;
        const end = raw.endDate || raw.end_time || raw.endTime || raw.endedAt || null;
        const startMs = validDate(start);
        const endMs = validDate(end);
        const locations = array(raw.locations || raw.affectedLocations || raw.affected_locations);
        const entities = Array.isArray(raw.entities) ? raw.entities.filter(item => item && typeof item === "object") : [];
        const provider = first(raw.provider, raw.service, raw.publisher, raw.outage?.provider, raw.dataSource, entities.find(item => /provider|service/i.test(text(item.entityName)))?.entityName);
        const outage = raw.outage && typeof raw.outage === "object" ? raw.outage : {};
        const sourceUrl = first(raw.sourceUrl, raw.source_url, raw.linkedUrl, raw.linked_url);
        const status = endMs ? "resolved" : (startMs || raw.endDate === null || raw.end_date === null ? "unknown" : "unavailable");
        return {
            id, provider, description: first(raw.description, raw.summary, "No incident description supplied."), source: first(raw.source, raw.dataSource, "Cloudflare Radar"), sourceUrl: sourceUrl === "Unknown" ? "" : sourceUrl,
            eventType: first(raw.eventType, raw.event_type, "Outage"), cause: first(raw.outageCause, raw.outage_cause, outage.outageCause, "Unknown"), outageType: first(raw.outageType, raw.outage_type, outage.outageType, "Unknown"), scope: first(raw.scope, "Unknown"), locations,
            start, end, startMs, endMs, status, raw
        };
    }

    function normalizeRecords(rawRecords) {
        const byId = new Map();
        (Array.isArray(rawRecords) ? rawRecords : []).forEach(raw => {
            const record = normalizeRecord(raw);
            if (record && !byId.has(record.id)) byId.set(record.id, record);
        });
        return [...byId.values()];
    }

    function formatDate(value, fallback = "Unknown") { const time = validDate(value); return time === null ? fallback : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(time); }
    function statusLabel(status) { return status === "resolved" ? "Resolved" : status === "unknown" ? "Resolution unknown" : "Status unavailable"; }
    function withinHours(record, hours) { const basis = record.startMs || record.endMs; return basis !== null && Date.now() - basis <= hours * 60 * 60 * 1000 && basis <= Date.now(); }
    function setStatus(kind, label) { const node = $("monitor-status"); node.className = `monitor-status monitor-status--${kind}`; $("monitor-status-text").textContent = label; }
    function showNotice(message, error = false) { const node = $("monitor-notice"); node.hidden = !message; node.className = `monitor-notice${error ? " monitor-notice--error" : ""}`; node.textContent = message || ""; }

    async function fetchPublication(path, signal) {
        const response = await fetch(`${API_ROOT}${path}`, { cache: "no-store", headers: { Accept: "application/json" }, signal });
        if (!response.ok) throw new Error(`Monitoring Worker returned HTTP ${response.status}`);
        const payload = await response.json();
        if (!payload || !Array.isArray(payload.outages)) throw new Error(`Monitoring Worker returned an invalid ${path} publication`);
        return payload;
    }

    const COUNTRY_NAMES = { US: "United States", DE: "Germany", GB: "United Kingdom", FR: "France", NL: "Netherlands", IN: "India", AU: "Australia", JP: "Japan", CA: "Canada", IT: "Italy", ES: "Spain", BR: "Brazil", RU: "Russia", CN: "China", KR: "South Korea", SE: "Sweden", CH: "Switzerland" };

    function radwareEntries(value) {
        return (Array.isArray(value) ? value : [])
            .filter(item => item && typeof item.name === "string" && Number.isFinite(Number(item.value)))
            .map(item => ({ ...item, numericValue: Number(item.value) }));
    }

    function countryLabel(name) {
        const code = text(name).toUpperCase();
        const readable = COUNTRY_NAMES[code] || text(name);
        const flag = /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(letter => 127397 + letter.charCodeAt(0))) : "";
        return { readable, flag };
    }

    function renderRadwareBars(node, entries, countries = false, showPercent = false) {
        node.classList?.remove?.("monitor-radware-values--treemap");
        node.replaceChildren();
        if (!entries.length) { node.append(Object.assign(document.createElement("em"), { textContent: "No published values" })); return; }
        const max = Math.max(...entries.map(item => item.numericValue), 1);
        const total = entries.reduce((sum, item) => sum + item.numericValue, 0);
        entries.forEach(item => {
            const row = document.createElement("div"); row.className = "monitor-radware-stat";
            const label = document.createElement("span");
            if (countries) { const country = countryLabel(item.name); label.textContent = `${country.flag ? `${country.flag} ` : ""}${country.readable}`; label.title = item.name; }
            else label.textContent = item.name;
            const track = document.createElement("span"); track.className = "monitor-radware-stat__track";
            const fill = document.createElement("span"); fill.className = "monitor-radware-stat__fill"; fill.style.width = `${Math.max(2, item.numericValue / max * 100)}%`; track.append(fill);
            const value = document.createElement("strong");
            const percentage = total > 0 ? (item.numericValue / total) * 100 : 0;
            value.textContent = showPercent ? `${item.numericValue} (${percentage.toFixed(1)}%)` : String(item.numericValue);
            value.title = showPercent ? "Raw value and share of the full returned category sample" : "Raw value returned by Radware";
            row.append(label, track, value); node.append(row);
        });
    }

    function renderRadwareTreemap(node, entries) {
        node.classList.add("monitor-radware-values--treemap"); node.replaceChildren();
        if (!entries.length) { node.append(Object.assign(document.createElement("em"), { textContent: "No published values" })); return; }
        entries.forEach(item => {
            const tile = document.createElement("div"); tile.className = "monitor-radware-tile"; tile.style.flexGrow = String(Math.max(item.numericValue, 1));
            tile.title = `Port ${item.name}: ${item.numericValue} returned value`; tile.setAttribute("aria-label", `Port ${item.name}, value ${item.numericValue}`);
            const port = document.createElement("strong"); port.textContent = item.name; const value = document.createElement("small"); value.textContent = String(item.numericValue);
            tile.append(port, value); node.append(tile);
        });
    }

    function renderRadware() {
        const status = $("radware-status");
        const updated = $("radware-updated");
        const payload = radwareState.payload;
        status.className = "monitor-radware-status";
        if (radwareState.error && !payload) {
            status.classList.add("monitor-radware-status--error");
            status.textContent = "Radware feed unavailable";
            updated.textContent = "Radware statistics could not be loaded. No values are being inferred.";
        } else if (payload) {
            const collected = formatDate(payload.collected_at);
            const retained = Boolean(radwareState.error);
            status.classList.toggle("monitor-radware-status--stale", Boolean(payload.stale) || retained);
            status.classList.toggle("monitor-radware-status--error", retained);
            status.textContent = retained ? `Feed unavailable · last collected ${collected}` : payload.stale ? `Stale data · collected ${collected}` : `Updated ${collected}`;
            updated.textContent = retained
                ? `The latest refresh failed. Showing the last successful collection from ${collected}; no new values are inferred.`
                : payload.stale
                ? `Collection timestamp: ${collected}. Values are shown for transparency but should be treated as stale. Ranked categories include raw values and category-share percentages; ports remain raw.`
                : `Collection timestamp: ${collected}. Values are aggregate Radware statistics; ranked categories include raw values and category-share percentages, while ports remain raw.`;
        }
        RADWARE_CATEGORIES.forEach(([category, id]) => {
            const node = $(id);
            const entries = radwareEntries(payload?.categories?.[category]);
            if (category === "scanned_udp_ports" || category === "scanned_tcp_ports") renderRadwareTreemap(node, entries);
            else renderRadwareBars(node, entries, category === "top_attackers" || category === "top_attacked", true);
        });
    }

    function downradarStatusLabel(status) { return text(status).replace(/\b\w/g, letter => letter.toUpperCase()); }
    function downradarTone(status) {
        const value = text(status).toLowerCase();
        if (value === "ok" || value === "operational") return "operational";
        if (value === "degraded") return "degraded";
        if (value === "partial" || value === "partial outage") return "partial";
        if (value === "major" || value === "major outage") return "major";
        return "unknown";
    }
    function downradarActiveRecords(payload) {
        const allowed = new Set(["degraded", "partial", "major"]);
        return (Array.isArray(payload?.active_disruptions) ? payload.active_disruptions : []).filter(item => item && allowed.has(text(item.status_raw).toLowerCase()) && item.monitoring_paused !== true);
    }
    function dedupeDownradarIncidents(items) {
        const seen = new Set();
        return (Array.isArray(items) ? items : []).filter(item => {
            if (!item || !item.slug || !item.changed_at) return false;
            const key = [item.slug, item.from_raw || item.from, item.to_raw || item.to, item.changed_at].map(text).join("|");
            if (seen.has(key)) return false; seen.add(key); return true;
        });
    }
    function appendLink(parent, href, label) {
        if (!/^https:\/\//.test(text(href))) return;
        const link = document.createElement("a"); link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = label; parent.append(link);
    }
    function renderDownRadar() {
        const status = $("downradar-status"), meta = $("downradar-meta"), disruptionsNode = $("downradar-disruptions"), incidentsNode = $("downradar-incidents");
        const disruptionPayload = downradarState.disruptions, incidentPayload = downradarState.incidents;
        status.className = "monitor-radware-status";
        if (downradarState.errors.length && !disruptionPayload && !incidentPayload) {
            status.classList.add("monitor-radware-status--error"); status.textContent = "DownRadar unavailable"; meta.textContent = "DownRadar could not be reached. No operational state is inferred.";
        } else {
            const payload = disruptionPayload || incidentPayload, collected = formatDate(payload?.collected_at), stale = Boolean(disruptionPayload?.stale || incidentPayload?.stale);
            status.classList.toggle("monitor-radware-status--stale", stale || Boolean(downradarState.errors.length));
            status.textContent = downradarState.errors.length ? `Partial feed · collected ${collected}` : stale ? `Stale data · collected ${collected}` : `Updated ${collected}`;
            const count = Number(disruptionPayload?.count ?? 0), services = Number(disruptionPayload?.monitored_services ?? incidentPayload?.monitored_services ?? 0);
            meta.textContent = `${count} active disruptions across ${services} monitored services. ${stale ? "Source data is stale." : "Status is provider-reported, not independently verified."}`;
            $("downradar-active-count").textContent = count || "0";
            $("downradar-service-count").textContent = services || "0";
            $("downradar-meta-live").textContent = meta.textContent;
            $("live-metric-active").textContent = count || "0";
            $("live-metric-services").textContent = services || "0";
            const incidents = dedupeDownradarIncidents(incidentPayload?.recent_incidents);
            $("live-metric-transitions").textContent = incidents.length;
            $("live-signal-status").textContent = stale ? "stale source" : `updated ${formatDate(payload?.collected_at)}`;
            recordSignal({ active: count, reports: state.records.length, incidents, collectedAt: payload?.collected_at || incidentPayload?.collected_at, stale });
        }
        const active = downradarActiveRecords(disruptionPayload); disruptionsNode.replaceChildren();
        if (!active.length) { const empty = document.createElement("p"); empty.className = "monitor-empty"; empty.textContent = downradarState.errors.length ? "Active disruptions are unavailable." : "No active service disruptions reported by DownRadar."; disruptionsNode.append(empty); }
        else active.forEach(item => {
            const article = document.createElement("article"); article.className = "monitor-downradar-card";
            const top = document.createElement("div"); top.className = "monitor-incident__top"; const heading = document.createElement("h3"); heading.textContent = item.name || item.slug;
            const badge = document.createElement("span"); badge.className = `monitor-badge monitor-downradar-status--${downradarTone(item.status_raw || item.status)}`; badge.textContent = downradarStatusLabel(item.status || item.status_raw); top.append(heading, badge);
            const metaRow = document.createElement("div"); metaRow.className = "monitor-incident__meta";
            [item.degraded_components != null ? `${item.degraded_components}/${item.components || "?"} components affected` : "Affected components unavailable", `Changed ${formatDate(item.changed_at)}`, `Checked ${formatDate(item.last_polled_at)}`].forEach(value => { const span = document.createElement("span"); span.textContent = value; metaRow.append(span); });
            const note = document.createElement("p"); note.textContent = item.monitoring_paused === null ? "Monitoring state unverified; this record is not treated as independently confirmed." : (item.freshness === "stale" || disruptionPayload?.stale ? "DownRadar reports this disruption, but the source data is stale." : "DownRadar aggregated provider-reported status; not independently verified."); article.append(top, metaRow, note);
            const detail = Array.isArray(item.incidents) ? item.incidents.find(incident => incident && (incident.status || incident.impact || incident.started_at)) : null;
            if (detail) { const incident = document.createElement("p"); incident.className = "monitor-downradar-detail"; incident.textContent = `Reported incident: ${downradarStatusLabel(detail.status || "status unavailable")}${detail.impact ? ` · ${downradarStatusLabel(detail.impact)} impact` : ""}${detail.started_at ? ` · started ${formatDate(detail.started_at)}` : ""}`; article.append(incident); appendLink(article, detail.url, "Open incident details ↗"); }
            appendLink(article, item.source_url, "Open official status page ↗"); disruptionsNode.append(article);
        });
        const incidents = dedupeDownradarIncidents(incidentPayload?.recent_incidents).sort((a, b) => (validDate(b.changed_at) || 0) - (validDate(a.changed_at) || 0)); incidentsNode.replaceChildren();
        if (!incidents.length) { const empty = document.createElement("p"); empty.className = "monitor-empty"; empty.textContent = downradarState.errors.length ? "Recent transitions are unavailable." : "No recent DownRadar transitions reported."; incidentsNode.append(empty); }
        else incidents.forEach(item => { const article = document.createElement("article"); article.className = "monitor-downradar-incident"; const heading = document.createElement("h3"); heading.textContent = item.name || item.slug; const transition = document.createElement("div"); transition.className = "monitor-downradar-transition"; const from = document.createElement("span"); from.className = `monitor-downradar-transition__status monitor-downradar-status--${downradarTone(item.from_raw || item.from)}`; from.textContent = item.from || "Unknown"; const arrow = document.createElement("span"); arrow.className = "monitor-downradar-transition__arrow"; arrow.textContent = "→"; const to = document.createElement("span"); to.className = `monitor-downradar-transition__status monitor-downradar-status--${downradarTone(item.to_raw || item.to)}`; to.textContent = item.to || "Unknown"; transition.append(from, arrow, to); if (item.recovered) { const recovered = document.createElement("small"); recovered.className = "monitor-downradar-recovered"; recovered.textContent = "Recovered"; transition.append(recovered); } const when = document.createElement("time"); when.dateTime = item.changed_at; when.textContent = `Observed ${formatDate(item.changed_at)}`; article.append(heading, transition, when); appendLink(article, item.source_url, "Open official status page ↗"); incidentsNode.append(article); });
    }

    function signalValue({ active = 0, reports = 0, incidents = [], stale = false } = {}) {
        const validIncidents = dedupeDownradarIncidents(incidents);
        const recovered = validIncidents.filter(item => item.recovered || downradarTone(item.to_raw || item.to) === "operational").length;
        const changed = Math.max(0, validIncidents.length - recovered);
        const value = Math.max(0, Number(active) || 0) + Math.max(0, Number(reports) || 0) * .25 + changed * .35 - recovered * .35;
        return { value, active: Math.max(0, Number(active) || 0), reports: Math.max(0, Number(reports) || 0), changed, recovered, stale };
    }

    function recordSignal(sample) {
        const components = signalValue(sample);
        const key = [sample?.collectedAt || "", components.active, components.reports, components.changed, components.recovered, components.stale].join("|");
        if (key === state.lastSignalKey) return;
        state.lastSignalKey = key;
        state.signalHistory = [...state.signalHistory, { ...components, at: Date.now() }].slice(-18);
        renderLiveSignal();
    }

    function renderLiveSignal() {
        const node = $("live-signal-chart");
        if (!node) return;
        const samples = state.signalHistory;
        const values = samples.map(item => item.value);
        if (!values.length) { node.textContent = "Waiting for live samples"; return; }
        const max = Math.max(...values, 1), min = Math.min(...values, 0), span = Math.max(max - min, 1);
        const denominator = Math.max(values.length - 1, 1);
        const points = values.map((value, index) => `${(index / denominator) * 100},${88 - ((value - min) / span) * 66}`).join(" ");
        const visiblePoints = values.length === 1 ? `0,${88 - ((values[0] - min) / span) * 66} 100,${88 - ((values[0] - min) / span) * 66}` : points;
        const latest = samples[samples.length - 1];
        node.setAttribute("aria-label", `Live signal level ${latest.value.toFixed(2)}: ${latest.active} active disruptions, ${latest.reports} outage reports, ${latest.changed} active transitions, ${latest.recovered} recoveries${latest.stale ? ", source stale" : ""}.`);
        node.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="signal-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b3131b" stop-opacity=".22"/><stop offset="1" stop-color="#b3131b" stop-opacity="0"/></linearGradient></defs><path class="monitor-signal-chart__area" d="M ${visiblePoints} L 100 100 L 0 100 Z"></path><polyline class="monitor-signal-chart__line" points="${visiblePoints}"></polyline>${values.map((value, index) => `<circle cx="${values.length === 1 ? 50 : (index / denominator) * 100}" cy="${88 - ((value - min) / span) * 66}" r="1.35"></circle>`).join("")}</svg>`;
    }
    async function requestDownRadar() {
        if (downradarState.inFlight) return; downradarState.inFlight = true; downradarState.errors = [];
        const requests = [["/api/downradar/disruptions", "active_disruptions"], ["/api/downradar/incidents", "recent_incidents"]];
        const results = await Promise.all(requests.map(async ([path, key]) => { try { const response = await fetch(`${API_ROOT}${path}`, { cache: "no-store", headers: { Accept: "application/json" } }); if (!response.ok) throw new Error(`DownRadar Worker returned HTTP ${response.status}`); const payload = await response.json(); if (!payload || !Array.isArray(payload[key])) throw new Error(`DownRadar returned an invalid ${key} publication`); return { key, payload }; } catch (error) { return { key, error }; } }));
        results.forEach(result => { if (result.error) downradarState.errors.push(result.error); else downradarState[result.key === "active_disruptions" ? "disruptions" : "incidents"] = result.payload; }); downradarState.inFlight = false; renderDownRadar();
    }

    async function requestRadware() {
        if (radwareState.inFlight) return;
        radwareState.inFlight = true;
        try {
            const response = await fetch(`${API_ROOT}/api/radware/stats`, { cache: "no-store", headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error(`Radware Worker returned HTTP ${response.status}`);
            const payload = await response.json();
            if (!payload || payload.status !== "ok" || !payload.categories || typeof payload.categories !== "object") throw new Error("Radware Worker returned an invalid statistics publication");
            radwareState.payload = payload;
            radwareState.error = null;
        } catch (error) {
            radwareState.error = error;
        } finally {
            radwareState.inFlight = false;
        }
        renderRadware();
    }

    async function fetchOutagePublication(signal) {
        try { return { payload: await fetchPublication("/api/outages/all", signal), fallback: false }; }
        catch (allError) {
            if (allError?.name === "AbortError") throw allError;
            const [current, history] = await Promise.all([
                fetchPublication("/api/outages/current", signal),
                fetchPublication("/api/outages/history", signal)
            ]);
            const byId = new Map([...current.outages, ...history.outages].map(item => [text(item?.id || item?.outageId || item?.outage_id), item]).filter(([id]) => id));
            return { payload: { ...current, outages: [...byId.values()], timestamp: current.timestamp || history.timestamp }, fallback: true };
        }
    }

    async function requestData() {
        if (state.refreshInFlight) return;
        state.refreshInFlight = true;
        state.controller?.abort();
        const controller = new AbortController(); state.controller = controller;
        try {
            const publication = await fetchOutagePublication(controller.signal);
            const payload = publication.payload;
            const records = normalizeRecords(payload.outages);
            state.records = records; state.responseAt = Date.now(); state.backendTimestamp = payload.timestamp || null; state.error = null;
            setStatus("online", "Worker online");
            const age = state.backendTimestamp ? Date.now() - (validDate(state.backendTimestamp) || Date.now()) : 0;
            if (age > STALE_MS) { setStatus("stale", "Data stale"); showNotice("The Worker responded, but its collection timestamp is stale. Counts below reflect the last successful response."); }
            else if (publication.fallback) showNotice("The primary all-outages endpoint was unavailable. Current and history endpoints were combined for this response.");
            else showNotice(records.length ? "" : "No outage reports available in the current monitoring window.");
        } catch (error) {
            if (error?.name !== "AbortError") { state.error = error; setStatus("error", "Worker unavailable"); showNotice(`The outage Worker could not be reached. ${state.records.length ? "The last successful dataset is still displayed." : "No outage dataset is available yet."}`, true); }
        } finally { state.refreshInFlight = false; state.controller = null; render(); if (downradarState.disruptions || downradarState.incidents) recordSignal({ active: Number(downradarState.disruptions?.count ?? 0), reports: state.records.length, incidents: dedupeDownradarIncidents(downradarState.incidents?.recent_incidents), collectedAt: downradarState.disruptions?.collected_at || downradarState.incidents?.collected_at, stale: Boolean(downradarState.disruptions?.stale || downradarState.incidents?.stale) }); }
    }

    function populateSelect(id, values, label) { const select = $(id); const previous = select.value; select.replaceChildren(new Option(label, "all")); [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b)).forEach(value => select.add(new Option(value, value))); select.value = values.includes(previous) ? previous : "all"; }
    function applyFilters() {
        const query = text($("monitor-search").value).toLowerCase(), provider = $("monitor-provider").value, classification = $("monitor-classification").value, resolution = $("monitor-resolution").value, range = Number($("monitor-range").value);
        state.filtered = state.records.filter(record => (!query || `${record.provider} ${record.description} ${record.source} ${record.sourceUrl}`.toLowerCase().includes(query)) && (provider === "all" || record.provider === provider) && (classification === "all" || record.eventType === classification) && (resolution === "all" || record.status === resolution) && withinHours(record, range));
        const sort = $("monitor-sort").value;
        state.filtered.sort((a, b) => sort === "provider" ? a.provider.localeCompare(b.provider) : ((a.startMs || 0) - (b.startMs || 0)) * (sort === "oldest" ? 1 : -1));
    }

    function renderMetrics() { $("live-metric-reports").textContent = state.records.length; if (!downradarState.disruptions && !downradarState.incidents) { $("live-metric-active").textContent = "—"; $("live-metric-services").textContent = "—"; $("live-metric-transitions").textContent = "—"; } }
    function renderFeed() {
        const feed = $("monitor-feed"); $("feed-count").textContent = `${state.filtered.length} shown`;
        if (!state.filtered.length) { feed.innerHTML = `<div class="monitor-empty"><div><strong>No outage reports match this view.</strong><p>${state.records.length ? "Adjust the search or filters to inspect the current monitoring window." : "No outage reports available in the current monitoring window."}</p></div></div>`; return; }
        feed.replaceChildren(...state.filtered.map(record => { const article = document.createElement("article"); article.className = "monitor-incident"; const top = document.createElement("div"); top.className = "monitor-incident__top"; const heading = document.createElement("h3"); heading.textContent = record.provider; const badge = document.createElement("span"); badge.className = `monitor-badge monitor-badge--${record.status}`; badge.textContent = statusLabel(record.status); top.append(heading, badge); const description = document.createElement("p"); description.textContent = record.description; const meta = document.createElement("div"); meta.className = "monitor-incident__meta"; [record.eventType, `Start ${formatDate(record.start)}`, record.end ? `End ${formatDate(record.end)}` : "End unknown", record.locations.length ? record.locations.join(", ") : "Regions unknown"].forEach(value => { const span = document.createElement("span"); span.textContent = value; meta.append(span); }); const sourceTag = document.createElement("span"); sourceTag.className = "monitor-source-tag"; sourceTag.textContent = `Source: ${record.source}`; article.append(top, description, meta, sourceTag); if (record.sourceUrl) { const link = document.createElement("a"); link.href = record.sourceUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Open source ↗"; article.append(link); } return article; }));
    }
    function renderBars(target, entries, activity = false) { const node = $(target); node.replaceChildren(); if (!entries.length) { const empty = document.createElement("p"); empty.className = "monitor-empty"; empty.textContent = "No report data"; node.append(empty); return; } const max = Math.max(...entries.map(item => item.value), 1); entries.forEach(item => { const row = document.createElement("div"); row.className = "monitor-bar"; const label = document.createElement("span"); label.textContent = item.label; const track = document.createElement("span"); track.className = "monitor-bar__track"; const fill = document.createElement("span"); fill.className = "monitor-bar__fill"; fill.style.width = `${Math.max(2, item.value / max * 100)}%`; track.append(fill); const value = document.createElement("strong"); value.className = "monitor-bar__value"; value.textContent = item.value; row.append(label, track, value); node.append(row); }); }
    function renderCharts() { const providers = new Map(), days = new Map(); state.records.forEach(record => { providers.set(record.provider, (providers.get(record.provider) || 0) + 1); if (record.startMs) { const label = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(record.startMs); days.set(label, (days.get(label) || 0) + 1); } }); renderBars("provider-chart", [...providers].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }))); renderBars("activity-chart", [...days].map(([label, value]) => ({ label, value })).slice(-8), true); }
    function renderTimeline() { const node = $("monitor-timeline"); node.replaceChildren(); if (!state.filtered.length) { const empty = document.createElement("p"); empty.className = "monitor-empty"; empty.textContent = "No incidents in the selected time range."; node.append(empty); return; } state.filtered.forEach(record => { const item = document.createElement("article"); item.className = "monitor-timeline__item"; const time = document.createElement("time"); time.textContent = formatDate(record.start); const body = document.createElement("div"); const title = document.createElement("strong"); title.textContent = `${record.provider} · ${statusLabel(record.status)}`; const summary = document.createElement("p"); summary.textContent = record.description; body.append(title, summary); item.append(time, body); node.append(item); }); }
    function render() { if (!state.responseAt) { renderMetrics(); renderFeed(); renderCharts(); renderTimeline(); return; } populateSelect("monitor-provider", state.records.map(item => item.provider), "All providers"); populateSelect("monitor-classification", state.records.map(item => item.eventType), "All classifications"); applyFilters(); renderMetrics(); renderFeed(); renderCharts(); renderTimeline(); $("monitor-updated").textContent = `Last successful response: ${formatDate(state.responseAt)}`; $("timeline-window").textContent = `Previous ${$("monitor-range").value} HOURS`; }
    ["monitor-search", "monitor-provider", "monitor-classification", "monitor-resolution", "monitor-range", "monitor-sort"].forEach(id => $(id).addEventListener("input", render));
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { requestData(); requestRadware(); requestDownRadar(); } });
    requestData(); requestRadware(); requestDownRadar();
    window.setInterval(() => { if (document.visibilityState === "visible") requestData(); }, REFRESH_MS);
    window.setInterval(() => { if (document.visibilityState === "visible") requestRadware(); }, RADWARE_REFRESH_MS);
    window.setInterval(() => { if (document.visibilityState === "visible") requestDownRadar(); }, RADWARE_REFRESH_MS);
    window.MonitorData = { normalizeRecord, normalizeRecords, statusLabel, dedupeDownradarIncidents, downradarActiveRecords, downradarTone, signalValue };
}());

(function () {
    "use strict";

    const API_ROOT = "https://ddos-detector.newhorse62.workers.dev";
    const REFRESH_MS = 60 * 1000;
    const STALE_MS = 10 * 60 * 1000;
    const state = { records: [], filtered: [], responseAt: null, backendTimestamp: null, error: null, controller: null, refreshInFlight: false };
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
        } finally { state.refreshInFlight = false; state.controller = null; render(); }
    }

    function populateSelect(id, values, label) { const select = $(id); const previous = select.value; select.replaceChildren(new Option(label, "all")); [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b)).forEach(value => select.add(new Option(value, value))); select.value = values.includes(previous) ? previous : "all"; }
    function applyFilters() {
        const query = text($("monitor-search").value).toLowerCase(), provider = $("monitor-provider").value, classification = $("monitor-classification").value, resolution = $("monitor-resolution").value, range = Number($("monitor-range").value);
        state.filtered = state.records.filter(record => (!query || `${record.provider} ${record.description} ${record.source} ${record.sourceUrl}`.toLowerCase().includes(query)) && (provider === "all" || record.provider === provider) && (classification === "all" || record.eventType === classification) && (resolution === "all" || record.status === resolution) && withinHours(record, range));
        const sort = $("monitor-sort").value;
        state.filtered.sort((a, b) => sort === "provider" ? a.provider.localeCompare(b.provider) : ((a.startMs || 0) - (b.startMs || 0)) * (sort === "oldest" ? 1 : -1));
    }

    function renderMetrics() { const unresolved = state.records.filter(item => item.status === "unknown").length, resolved = state.records.filter(item => item.status === "resolved").length; $("metric-unresolved").textContent = unresolved; $("metric-resolved").textContent = resolved; $("metric-recent").textContent = state.records.filter(item => withinHours(item, 24)).length; $("metric-total").textContent = state.records.length; }
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
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") requestData(); });
    requestData(); window.setInterval(() => { if (document.visibilityState === "visible") requestData(); }, REFRESH_MS);
    window.MonitorData = { normalizeRecord, normalizeRecords, statusLabel };
}());

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const mapScript = fs.readFileSync(path.join(root, "assets", "js", "sentinel-map.js"), "utf8");
const adapterScript = fs.readFileSync(path.join(root, "assets", "js", "sentinel-gods-eye-adapter.js"), "utf8");
const page = fs.readFileSync(path.join(root, "sentinel.html"), "utf8");
const mapStyles = fs.readFileSync(path.join(root, "assets", "css", "sentinel-map.css"), "utf8");

assert.ok(mapScript.includes('projection: { type: "globe" }'), "Sentinel must request globe projection");
assert.ok(mapScript.includes('map.setProjection?.({ type: "globe" })'), "Sentinel must enforce globe projection after load");
assert.ok(!mapScript.includes("cluster: true"), "No point source may group events into numbered clusters");
assert.ok(!mapScript.includes('id: "cluster-count"'), "Primary event cluster labels must not exist");
assert.ok(!mapScript.includes('id: "x-early-report-cluster-count"'), "Early-report cluster labels must not exist");
assert.ok(mapScript.includes('"icon-allow-overlap": true'), "Individual event symbols must remain visible at global zoom");
assert.ok(mapScript.includes('"icon-ignore-placement": true'), "Individual event symbols must not be hidden by collision placement");
assert.ok(mapScript.includes("if (!visibleCategories.has(category)) return false;"), "Clearing all category toggles must show no events");
assert.ok(adapterScript.includes('return "military_aircraft"'), "Military and civilian aircraft must have independent categories");
assert.ok(page.includes('data-map-mode="nvg"') && page.includes('data-map-mode="flir"'), "Gods Eye-inspired visual modes must be present");
assert.ok(!page.toLowerCase().includes("tap a pinpoint or cluster"), "Instructions must describe individual markers");
assert.ok(mapScript.includes("weatherColorExpression"), "Weather polygons must be styled by severity");
assert.ok(mapScript.includes("isExpiredWeatherEvent"), "Expired weather alerts must be removed client-side");
assert.ok(mapScript.includes("isWeatherTestMessage"), "Administrative weather tests must not be rendered");
assert.ok(mapScript.includes("loadEnvironmentalLayers({ refreshOnly: true })"), "Weather data must be refetched during live refresh");
assert.ok(page.includes('id="layer-europe-nato"') && page.includes('id="layer-europe-reddit"'), "European security map controls must be present");
assert.ok(mapScript.includes('"missile_drone"') && mapScript.includes('"eastern_flank"'), "European events must support multi-layer filtering");
assert.ok(adapterScript.includes('rawType || "").toLowerCase() === "europe_security"'), "Europe security classifications must survive adaptation");
assert.match(mapScript, /id: "events",\s*type: "circle"[\s\S]*?"circle-color": threatColorExpression\(\)/, "The complete threat dot must use its threat-level color");
assert.ok(mapScript.includes('id: "event-glyphs"'), "Threat dots must retain category glyph overlays");
assert.ok(page.includes('&#128293;') && page.includes('&#9992;') && page.includes('&#9875;'), "Legend emoji and symbols must use encoding-safe numeric entities");
assert.ok(!page.includes("ðŸ") && !page.includes("âŒ"), "Legend must not contain mojibake glyphs");
assert.ok(mapStyles.includes("@media (min-width: 1181px)"), "Desktop Sentinel must have a dedicated viewport layout");
assert.ok(mapStyles.includes("height: 100dvh") && mapStyles.includes("width: 100vw"), "Desktop Sentinel must fill the browser viewport");
assert.match(mapStyles, /grid-template-columns:\s*minmax\(210px, 16fr\)\s*minmax\(0, 65fr\)\s*minmax\(240px, 19fr\)/, "Desktop workspace must prioritize the center map");
assert.ok(mapStyles.includes("overflow: hidden") && mapStyles.includes("overflow-y: auto"), "Desktop page must lock outer scrolling while panels scroll internally");
assert.ok(mapScript.includes("new ResizeObserver(resizeMap)"), "MapLibre must resize when its grid area changes");

console.log("Sentinel Gods Eye contract tests passed");

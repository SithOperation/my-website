"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const mapScript = fs.readFileSync(path.join(root, "assets", "js", "sentinel-map.js"), "utf8");
const adapterScript = fs.readFileSync(path.join(root, "assets", "js", "sentinel-gods-eye-adapter.js"), "utf8");
const page = fs.readFileSync(path.join(root, "sentinel.html"), "utf8");

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

console.log("Sentinel Gods Eye contract tests passed");

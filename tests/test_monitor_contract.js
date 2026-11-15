const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/js/monitor.js", "utf8");
const listeners = {};
const elements = new Map();
function element(id) {
    if (!elements.has(id)) elements.set(id, { id, value: "all", textContent: "", className: "", hidden: false, replaceChildren() {}, addEventListener() {}, setAttribute() {}, append() {} });
    return elements.get(id);
}
function createElement() {
    return { className: "", textContent: "", style: {}, append() {} };
}
const context = {
    console,
    document: { getElementById: element, createElement, addEventListener(name, fn) { listeners[name] = fn; } },
    window: { setInterval() {}, MonitorData: {} },
    AbortController: class AbortController {
        constructor() { this.signal = {}; }
        abort() {}
    },
    Intl,
    Date,
    Option: function Option(label, value) { this.text = label; this.value = value; },
    fetch() { return Promise.reject(new Error("not called")); }
};
vm.runInNewContext(source, context);
const normalize = context.window.MonitorData.normalizeRecord;
const normalizeRecords = context.window.MonitorData.normalizeRecords;

const unknown = normalize({ id: "1", dataSource: "HTTP_ORIGINS", description: "Provider disruption", startDate: "2026-11-14T00:00:00Z", endDate: null, eventType: "OUTAGE", outage: { outageCause: "TECHNICAL_PROBLEM", outageType: "PLATFORM" } });
assert.equal(unknown.status, "unknown");
assert.equal(unknown.provider, "HTTP_ORIGINS");

const resolved = normalize({ id: "2", provider: "Example ISP", startDate: "2026-11-14T00:00:00Z", endDate: "2026-11-14T01:00:00Z", locations: ["Region A"] });
assert.equal(resolved.status, "resolved");
assert.equal(resolved.locations.length, 1);
assert.equal(resolved.locations[0], "Region A");

const unavailable = normalize({ id: "3", provider: "Unknown service", description: "No timing supplied" });
assert.equal(unavailable.status, "unavailable");
assert.equal(context.window.MonitorData.statusLabel("unknown"), "Resolution unknown");
assert.equal(normalizeRecords([]).length, 0);
assert.equal(normalizeRecords([null, { id: "dup", provider: "One" }, { id: "dup", provider: "Two" }]).length, 1);
console.log("Monitor contract tests passed");

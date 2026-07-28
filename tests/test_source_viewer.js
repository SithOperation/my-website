"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const windowMock = { matchMedia: () => ({ matches: false }) };
const context = {
    console,
    Date,
    Map,
    Number,
    Object,
    Set,
    URL,
    fetch: async () => {
        throw new Error("not used");
    },
    document: {
        addEventListener() {}
    },
    window: windowMock
};
const scriptPath = path.join(__dirname, "..", "assets", "js", "sentinel-source-viewer.js");
vm.runInNewContext(fs.readFileSync(scriptPath, "utf8"), context, { filename: scriptPath });

const viewer = windowMock.SentinelSourceViewer;
assert.ok(viewer, "source viewer helpers must be exposed");

assert.equal(viewer.classifyFeed(null), "invalid");
assert.equal(viewer.classifyFeed({ health: { status: "fresh" }, items: [] }), "empty");
assert.equal(viewer.classifyFeed({ health: { status: "fresh" }, items: [{}] }), "available");
assert.equal(viewer.classifyFeed({ health: { status: "partial" }, items: [{}] }), "partial");
assert.equal(viewer.classifyFeed({ health: { status: "stale" }, items: [{}] }), "stale");
assert.equal(viewer.classifyFeed({ health: { status: "unavailable" }, items: [] }), "unavailable");
assert.equal(viewer.classifyFeed({ health: { status: "unexpected" }, items: [] }), "invalid");

assert.equal(viewer.safeSourceUrl("javascript:alert(1)"), "");
assert.equal(viewer.safeSourceUrl("http://example.com/report"), "");
assert.equal(viewer.safeSourceUrl("https://example.com/report"), "https://example.com/report");

const normalized = viewer.normalizeItem({
    id: "src_1",
    platform: "x",
    source_name: "Example Source",
    source_handle: "@example",
    source_url: "https://x.com/example/status/123",
    published_at: "2026-07-28T05:30:00Z",
    title: "<script>text only</script>",
    text: "Reported activity near Kharkiv.",
    feed_eligible: true,
    location_label: "Kharkiv, Ukraine",
    location_status: "source_reported",
    location_confidence: 0.91,
    claim_status: "unverified",
    claim_confidence: 0.38
});
assert.equal(normalized.sourceName, "Example Source");
assert.equal(normalized.locationStatus, "Source Reported");
assert.equal(normalized.locationConfidence, "91%");
assert.equal(normalized.claimStatus, "Unverified");
assert.equal(normalized.claimConfidence, "38%");
assert.equal(normalized.title, "<script>text only</script>");
assert.equal(viewer.normalizeItem({ feed_eligible: false }), null);
assert.equal(viewer.normalizeItem({ feed_eligible: true, source_url: "javascript:alert(1)" }), null);

[
    "loading",
    "available",
    "empty",
    "partial",
    "stale",
    "unavailable",
    "invalid"
].forEach(state => assert.ok(viewer.stateMessage(state, 2), `missing state message for ${state}`));

console.log("Source viewer tests passed");

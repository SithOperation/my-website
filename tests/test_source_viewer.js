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
const sourceViewerScript = fs.readFileSync(scriptPath, "utf8");
vm.runInNewContext(sourceViewerScript, context, { filename: scriptPath });

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
assert.equal(viewer.safeSourceUrl("https://user:secret@example.com/report"), "");
assert.equal(viewer.safeSourceUrl("data:text/html,unsafe"), "");
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
    claim_confidence: 0.38,
    event_id: "evt_1",
    association_status: "associated",
    association_method: "location_time_similarity",
    association_confidence: 0.77,
    map_eligible: true
});
assert.equal(normalized.sourceName, "Example Source");
assert.equal(normalized.locationStatus, "Source Reported");
assert.equal(normalized.locationConfidence, "91%");
assert.equal(normalized.claimStatus, "Unverified");
assert.equal(normalized.claimConfidence, "38%");
assert.equal(normalized.eventId, "evt_1");
assert.equal(normalized.associationStatus, "Associated");
assert.equal(normalized.associationConfidence, "77%");
assert.equal(normalized.canLocate, true);
assert.equal(normalized.title, "<script>text only</script>");
assert.equal(viewer.normalizeItem({ feed_eligible: false }), null);
assert.equal(viewer.normalizeItem({ feed_eligible: true, source_url: "javascript:alert(1)" }), null);
assert.equal(viewer.normalizeItem({
    feed_eligible: true,
    source_url: "https://example.com/feed-only",
    published_at: "2026-07-28T05:30:00Z",
    event_id: "evt_1",
    map_eligible: false
}).canLocate, false);
assert.equal(viewer.normalizeItem({
    feed_eligible: true,
    source_url: "https://reddit.com/r/example/comments/123/report",
    published_at: "2026-07-28T05:30:00Z",
    event_id: "SG-123",
    association_status: "confirmed",
    map_eligible: true,
    latitude: 49.99,
    longitude: 36.23
}).canLocate, true);
assert.equal(viewer.normalizeItem({
    feed_eligible: true,
    source_url: "https://example.com/invalid-coordinate",
    published_at: "2026-07-28T05:30:00Z",
    event_id: "evt_1",
    association_status: "associated",
    map_eligible: true,
    latitude: 120,
    longitude: 30
}).canLocate, false);
assert.equal(viewer.normalizeItem({
    feed_eligible: true,
    source_url: "https://example.com/candidate",
    published_at: "2026-07-28T05:30:00Z",
    event_id: "evt_1",
    association_status: "candidate",
    map_eligible: true
}).canLocate, false);

[
    "loading",
    "available",
    "empty",
    "partial",
    "stale",
    "unavailable",
    "invalid"
].forEach(state => assert.ok(viewer.stateMessage(state, 2), `missing state message for ${state}`));

const largeFeedStart = Date.now();
const largeFeed = Array.from({ length: 2000 }, (_, index) => viewer.normalizeItem({
    id: `src_${index}`,
    platform: "rss",
    source_url: `https://example.com/reports/${index}`,
    published_at: "2026-07-28T05:30:00Z",
    title: "A".repeat(5000),
    text: "B".repeat(10000),
    feed_eligible: true,
    map_eligible: false
}));
assert.equal(largeFeed.filter(Boolean).length, 2000);
assert.equal(largeFeed[0].title.length, 4000);
assert.equal(largeFeed[0].text.length, 4000);
assert.ok(Date.now() - largeFeedStart < 2000, "large feed normalization must remain responsive");
assert.ok(!sourceViewerScript.includes(".innerHTML"), "source viewer must not use innerHTML");
assert.ok(!sourceViewerScript.includes("document.write"), "source viewer must not use document.write");
assert.ok(!/<(?:img|video|audio|iframe)\b/i.test(sourceViewerScript), "viewer must not create remote media elements");

console.log("Source viewer tests passed");

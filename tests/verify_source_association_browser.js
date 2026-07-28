"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium, firefox, webkit } = require("playwright");

const baseUrl = String(process.env.TEST_BASE_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
const engineName = String(process.env.BROWSER_ENGINE || "chromium");
const engine = { chromium, firefox, webkit }[engineName];
if (!engine) throw new Error(`Unsupported browser engine: ${engineName}`);
const mapEvents = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "map_events.json"), "utf8"));
const retentionThreshold = Date.now() - 48 * 60 * 60 * 1000;
const target = mapEvents.find(event => event.event_id && Number.isFinite(Number(event.latitude)) &&
    Number.isFinite(Number(event.longitude)) && Date.parse(event.timestamp || "") >= retentionThreshold);
if (!target) throw new Error("A mappable event fixture is required");

const baseItem = {
    platform: "x",
    source_id: "browser_fixture",
    source_name: "Browser Fixture",
    source_handle: "@fixture",
    published_at: "2026-07-28T08:00:00Z",
    title: "Associated browser fixture",
    text: "<script>Hostile markup remains visible text.</script>",
    feed_eligible: true,
    map_eligible: true,
    location_label: "Published event location",
    location_status: "source_reported",
    location_confidence: 0.9,
    claim_status: "unverified",
    claim_confidence: 0.4,
    event_id: target.event_id,
    association_status: "associated",
    association_method: "published_event_id",
    association_confidence: 0.95
};
const fixture = {
    schema_version: "1.0",
    publication_id: "fixture",
    generated_at: "2026-07-28T08:10:00Z",
    count: 3,
    health: { status: "fresh", sources: [] },
    items: [
        { ...baseItem, id: "src_1", source_url: "https://example.com/one" },
        { ...baseItem, id: "src_2", source_url: "https://example.com/two", title: "Second associated report" },
        {
            ...baseItem,
            id: "src_3",
            source_url: "https://example.com/feed-only",
            title: "Feed-only report",
            event_id: null,
            map_eligible: false,
            association_status: "unassociated"
        }
    ]
};

async function main() {
    const browser = await engine.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route("**/data/manifest.json*", async route => {
        const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "manifest.json"), "utf8"));
        await route.fulfill({ json: { ...manifest, publication_id: "fixture" } });
    });
    await page.route("**/data/source_feed.json*", route => route.fulfill({ json: fixture }));

    try {
        await page.goto(`${baseUrl}/sentinel.html`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => document.querySelector("#sentinel-map")?.dataset.mapReady === "true");
        await page.waitForFunction(() => document.querySelector("#source-viewer")?.dataset.feedState === "available");
        const initialDiagnostics = await page.evaluate(() => window.SentinelMapBridge.diagnostics());

        await page.locator("#source-viewer-open").click();
        if (await page.locator("#source-viewer").getAttribute("aria-modal") !== null) {
            throw new Error("Desktop dock must not expose aria-modal");
        }
        await page.locator("#source-viewer-close").focus();
        await page.keyboard.press("Shift+Tab");
        if (await page.evaluate(() => document.querySelector("#source-viewer")?.contains(document.activeElement))) {
            throw new Error("Desktop dock incorrectly trapped focus");
        }
        const locate = page.locator(".source-locate-action");
        if (await locate.isDisabled()) {
            const diagnostics = await page.evaluate(eventId => ({
                map: window.SentinelMapBridge.diagnostics(),
                hasEvent: window.SentinelMapBridge.hasEvent(eventId)
            }), target.event_id);
            throw new Error(`Locate unexpectedly disabled: ${JSON.stringify(diagnostics)}`);
        }
        await locate.focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(() =>
            document.querySelector("#source-viewer-announcement")?.textContent.includes("Located associated event")
        );
        const highlighted = await page.evaluate(() => window.SentinelMapBridge.diagnostics());
        if (highlighted.highlightedEventId !== target.event_id) throw new Error("Associated feature was not highlighted");
        if (highlighted.eventCount !== initialDiagnostics.eventCount) throw new Error("Locate rebuilt or duplicated map events");
        if (!await page.locator("#sentinel-map").isVisible()) throw new Error("Map was hidden by desktop viewer");

        await page.keyboard.press("Escape");
        if ((await page.evaluate(() => window.SentinelMapBridge.diagnostics())).highlightedEventId) {
            throw new Error("Highlight was not cleared when the viewer closed");
        }
        await page.locator("#event-detail .event-source-action").click();
        if (await page.locator("#source-viewer-position").textContent() !== "1 of 2") {
            throw new Error("Map-to-viewer associated subset was not selected");
        }
        await page.locator("#source-viewer-next").click();
        if (await page.locator("#source-viewer-position").textContent() !== "2 of 2") {
            throw new Error("Associated subset navigation failed");
        }
        await page.locator("#source-viewer-show-all").click();
        if (await page.locator("#source-viewer-position").textContent() !== "1 of 3") {
            throw new Error("Complete feed was not restored");
        }
        await page.locator("#source-viewer-next").click();
        await page.locator("#source-viewer-next").click();
        if (await page.locator(".source-locate-action:visible").count() !== 0) {
            throw new Error("Feed-only item exposed a Locate action");
        }
        if (await page.locator(".source-card script").count() !== 0) {
            throw new Error("Hostile source text created executable markup");
        }

        await page.keyboard.press("Escape");

        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("#source-viewer-open").click();
        if (await page.locator("#source-viewer").getAttribute("aria-modal") !== "true") {
            throw new Error("Mobile Source Viewer was not modal");
        }
        if (!await page.locator(".ops-header").evaluate(node => node.inert)) {
            throw new Error("Mobile modal background was not inert");
        }
        await page.locator("#source-viewer-close").focus();
        await page.keyboard.press("Shift+Tab");
        if (!await page.evaluate(() => document.querySelector("#source-viewer")?.contains(document.activeElement))) {
            throw new Error("Mobile modal did not trap focus");
        }
        const closeBox = await page.locator("#source-viewer-close").boundingBox();
        if (!closeBox || closeBox.width < 44 || closeBox.height < 44) {
            throw new Error("Mobile close control is smaller than 44px");
        }
        await page.setViewportSize({ width: 844, height: 390 });
        await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
        if (await page.locator("#source-viewer-position").textContent() !== "3 of 3") {
            throw new Error("Orientation change did not preserve source selection");
        }
        await page.locator("#source-viewer-close").click();
        if (await page.locator(".ops-header").evaluate(node => node.inert)) {
            throw new Error("Background inertness was not cleared");
        }
        console.log(`Source association browser verification passed (${engineName})`);
    }
    finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

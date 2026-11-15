"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = String(process.env.LOCAL_BASE_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
const fixture = {
    status: "ok",
    category: "all",
    retention_hours: 72,
    timestamp: new Date().toISOString(),
    outages: [
        { id: "fixture-unknown", provider: "Example Cloud", description: "Regional service disruption", eventType: "OUTAGE", startDate: "2026-11-14T20:00:00Z", endDate: null, locations: ["Region A"], dataSource: "Fixture" },
        { id: "fixture-resolved", provider: "Example ISP", description: "Resolved network interruption", eventType: "NETWORK", startDate: "2026-11-14T18:00:00Z", endDate: "2026-11-14T19:00:00Z", locations: ["Region B"], dataSource: "Fixture" }
    ]
};
const radwareFixture = {
    status: "ok",
    provider: "Radware Live Threat Map",
    source_url: "https://livethreatmap.radware.com/",
    collected_at: new Date().toISOString(),
    stale: false,
    categories: {
        top_attackers: [{ name: "Example source", value: 12 }, { name: "Example source 2", value: 8 }],
        top_attacked: [{ name: "Example target", value: 9 }],
        network_vectors: [{ name: "TCP Flood", value: 8 }],
        application_violations: [{ name: "Access violations", value: 7 }],
        scanned_tcp_ports: [{ name: "443", value: 6 }],
        scanned_udp_ports: [{ name: "53", value: 5 }, { name: "123", value: 5 }]
    }
};
const downradarDisruptionsFixture = {
    status: "ok", provider: "DownRadar", collected_at: new Date().toISOString(), stale: false, monitored_services: 285, count: 2,
    active_disruptions: [
        { slug: "example-cloud", name: "Example Cloud", status: "degraded", status_raw: "degraded", monitoring_paused: false, freshness: "current", changed_at: "2026-11-15T03:00:00Z", last_polled_at: new Date().toISOString(), components: 4, degraded_components: 1, source_url: "https://status.example.com", incidents: [] },
        { slug: "paused-cloud", name: "Paused Cloud", status: "major outage", status_raw: "major", monitoring_paused: true, freshness: "current", changed_at: "2026-11-15T03:00:00Z", last_polled_at: new Date().toISOString(), components: 2, degraded_components: 2, source_url: "https://paused.example.com", incidents: [] }
    ]
};
const downradarIncidentsFixture = {
    status: "ok", provider: "DownRadar", collected_at: new Date().toISOString(), stale: false, monitored_services: 285, count: 3,
    recent_incidents: [
        { id: "1", slug: "example-cloud", name: "Example Cloud", from: "operational", to: "degraded", from_raw: "ok", to_raw: "degraded", changed_at: "2026-11-15T03:00:00Z", recovered: false, source_url: "https://status.example.com" },
        { id: "2", slug: "example-cloud", name: "Example Cloud", from: "operational", to: "degraded", from_raw: "ok", to_raw: "degraded", changed_at: "2026-11-15T03:00:00Z", recovered: false, source_url: "https://status.example.com" },
        { id: "3", slug: "other-cloud", name: "Other Cloud", from: "degraded", to: "operational", from_raw: "degraded", to_raw: "ok", changed_at: "2026-11-15T02:00:00Z", recovered: true, source_url: "https://other.example.com" }
    ]
};

async function main() {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/outages/all", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) }));
    await page.route("**/api/radware/stats", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(radwareFixture) }));
    await page.route("**/api/downradar/disruptions", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(downradarDisruptionsFixture) }));
    await page.route("**/api/downradar/incidents", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(downradarIncidentsFixture) }));

    try {
        for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
            await page.setViewportSize(viewport);
            const response = await page.goto(`${baseUrl}/monitor.html?viewport=${viewport.width}`, { waitUntil: "domcontentloaded", timeout: 30000 });
            assert.ok(response?.ok(), `${viewport.width}: monitor page failed to load`);
            await page.waitForFunction(() => document.querySelector("#monitor-status-text")?.textContent === "Worker online", { timeout: 10000 });
            assert.equal(await page.locator("#live-metric-reports").textContent(), "2");
            assert.equal(await page.locator("#live-metric-active").textContent(), "2");
            assert.equal(await page.locator("#live-metric-services").textContent(), "285");
            assert.equal(await page.locator("#live-metric-transitions").textContent(), "2");
            assert.equal(await page.locator("#downradar-active-count").textContent(), "2");
            assert.equal(await page.locator("#downradar-service-count").textContent(), "285");
            await page.waitForFunction(() => document.querySelector("#radware-status")?.textContent?.startsWith("Updated"), { timeout: 10000 });
            await page.waitForFunction(() => document.querySelector("#downradar-status")?.textContent?.startsWith("Updated"), { timeout: 10000 });
            assert.equal(await page.locator("#downradar-disruptions .monitor-downradar-card").count(), 1);
            assert.equal(await page.locator("#downradar-disruptions .monitor-downradar-status--degraded").count(), 1);
            assert.equal(await page.locator("#downradar-incidents .monitor-downradar-incident").count(), 2);
            assert.equal(await page.locator("#downradar-incidents .monitor-downradar-status--operational").count(), 2);
            assert.equal(await page.locator("#downradar-incidents .monitor-downradar-status--degraded").count(), 2);
            assert.equal(await page.locator("#radware-top-attackers strong").first().textContent(), "12 (60.0%)");
            assert.equal(await page.locator("#radware-scanned-udp-ports .monitor-radware-tile").count(), 2);
            assert.equal(await page.locator("#radware-scanned-udp-ports .monitor-radware-tile").first().locator("small").textContent(), "5");
            assert.equal(await page.locator(".monitor-badge--unknown").count(), 1);
            assert.equal(await page.locator(".monitor-badge--resolved").count(), 1);
            await page.locator("#monitor-provider").selectOption({ label: "Example ISP" });
            assert.equal(await page.locator(".monitor-incident").count(), 1);
            await page.locator("#monitor-provider").selectOption("all");
            const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
            assert.ok(geometry.width <= geometry.viewport + 1, `${viewport.width}: horizontal overflow`);
        }
        assert.equal(errors.length, 0, errors.join("; "));
        console.log("Monitor browser verification passed");
    } finally {
        await browser.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

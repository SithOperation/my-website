"use strict";

const { chromium } = require("playwright");

const baseUrl = String(process.env.PRODUCTION_BASE_URL || "https://sithbusiness.com").replace(/\/+$/, "");
const expectedPublication = String(process.env.EXPECTED_PUBLICATION_ID || "");

if (!expectedPublication) {
    throw new Error("EXPECTED_PUBLICATION_ID is required");
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const pageErrors = [];
    const isIgnoredThirdPartyCspError = message =>
        message.includes("violates the following Content Security Policy directive") &&
        (message.includes("clarity.ms") || message.includes("scripts.clarity.ms"));
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => {
        if (message.type() === "error" && !isIgnoredThirdPartyCspError(message.text())) {
            pageErrors.push(message.text());
        }
    });

    try {
        const url = `${baseUrl}/sentinel.html?audit=${Date.now()}`;
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (!response || !response.ok()) {
            throw new Error(`Global map returned HTTP ${response?.status() || "unknown"}`);
        }

        await page.waitForFunction(
            publication => {
                const status = document.querySelector("#ops-status-text")?.textContent || "";
                return status.includes(publication);
            },
            expectedPublication,
            { timeout: 30000 }
        );
        await page.waitForFunction(
            () => document.querySelector("#sentinel-map")?.dataset.mapReady === "true",
            { timeout: 30000 }
        );
        await page.waitForFunction(
            () => Number(document.querySelector("#sentinel-map")?.dataset.loadedEvents) > 0,
            { timeout: 30000 }
        );
        const coverageToggle = page.locator("#coverage-status-toggle");
        if (await coverageToggle.isVisible()) {
            await coverageToggle.click();
            const coverageDetails = page.locator("#coverage-details");
            await coverageDetails.waitFor({ state: "visible", timeout: 3000 });
            const coverageText = await coverageDetails.textContent();
            if (!coverageText?.includes("source") || coverageText.includes("{\"")) {
                throw new Error("Coverage fold-out did not expose readable source details");
            }
            await coverageToggle.click();
        }
        if (await page.locator("#sentinel-map").getAttribute("data-feed-state") !== "available") {
            throw new Error("Loaded Sentinel publication did not report an available feed state");
        }
        await page.waitForFunction(
            () => Number(document.querySelector("#sentinel-map")?.dataset.filteredEvents) > 0,
            { timeout: 30000 }
        );
        await page.waitForFunction(
            () => Number(document.querySelector("#sentinel-map")?.dataset.visibleEvents) > 0,
            { timeout: 30000 }
        );

        const cityPoint = await page.evaluate(() => window.SentinelMapBridge?.firstCityPoint());
        if (!cityPoint) throw new Error("Global map did not render a clickable major-city light");
        await page.mouse.click(cityPoint.x, cityPoint.y);
        await page.locator("#event-panel.is-open").waitFor({ state: "visible", timeout: 5000 });
        if (!(await page.locator("#event-drawer-title").textContent()).includes(cityPoint.name)) {
            throw new Error("Major-city light did not open the event drawer");
        }
        await page.locator("#event-panel-close").click();

        const eventPoint = await page.evaluate(() => window.SentinelMapBridge?.firstEventPoint());
        if (!eventPoint) throw new Error("Global map did not render an individual clickable event point");
        await page.mouse.click(eventPoint.x, eventPoint.y);
        await page.locator("#event-panel.is-open").waitFor({ state: "visible", timeout: 5000 });
        if (await page.locator("#event-detail").count() !== 1) {
            throw new Error("Individual event point did not open event details");
        }
        await page.locator("#event-panel-close").click();

        const plottedFeedCheck = await page.evaluate(async () => {
            const response = await fetch("data/map_events.json", { cache: "no-store" });
            const publishedEvents = await response.json();
            const target = publishedEvents.find(event => event.event_id &&
                Number.isFinite(Number(event.latitude)) &&
                Number.isFinite(Number(event.longitude)) &&
                !(Number(event.latitude) === 0 && Number(event.longitude) === 0));
            const diagnostics = window.SentinelMapBridge?.diagnostics();
            const plotted = diagnostics?.eventCoordinates?.find(item => item.eventId === target?.event_id);
            return {
                target,
                plotted,
                located: target ? window.SentinelMapBridge?.locateEvent(target.event_id, false) : false
            };
        });
        if (!plottedFeedCheck.target || !plottedFeedCheck.plotted) {
            throw new Error("Published map event was not indexed by the map");
        }
        if (Number(plottedFeedCheck.plotted.latitude) !== Number(plottedFeedCheck.target.latitude) ||
            Number(plottedFeedCheck.plotted.longitude) !== Number(plottedFeedCheck.target.longitude)) {
            throw new Error("Map event coordinates differ from the published feed");
        }
        if (!plottedFeedCheck.located) throw new Error("Published map event could not be located");
        await page.waitForTimeout(700);
        const point = await page.evaluate(eventId => window.SentinelMapBridge?.projectEvent(eventId), plottedFeedCheck.target.event_id);
        if (!point || point.x < 0 || point.y < 0 || point.x > 1440 || point.y > 1000) {
            throw new Error("Published map event did not project inside the map viewport");
        }
        await page.waitForFunction(
            eventId => [...document.querySelectorAll("#sentinel-event-hit-overlay button")]
                .some(button => button.dataset.eventId === eventId && !button.hidden),
            plottedFeedCheck.target.event_id,
            { timeout: 5000 }
        );
        await page.evaluate(eventId => {
            const button = [...document.querySelectorAll("#sentinel-event-hit-overlay button")]
                .find(item => item.dataset.eventId === eventId);
            button?.click();
        }, plottedFeedCheck.target.event_id);
        await page.locator(".maplibregl-popup").waitFor({ state: "visible", timeout: 5000 });
        if (await page.locator(".sentinel-popup").count() !== 1) {
            throw new Error("Located map event did not render an event popup");
        }
        if (!(await page.locator(".sentinel-popup").textContent()).includes("Source:")) {
            throw new Error("Event popup did not include source attribution");
        }
        const eventDetail = await page.locator("#event-detail").textContent();
        if (!eventDetail.includes("Historical publication record") && !eventDetail.includes("Recent publication record")) {
            throw new Error("Selected event did not expose its temporal status");
        }
        const popupLink = page.locator(".sentinel-popup a");
        if (await popupLink.count() !== 1 || !(await popupLink.getAttribute("href"))?.startsWith("https://")) {
            throw new Error("Event popup did not include a safe original-report link");
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("#event-list-toggle").click();
        await page.locator("#event-panel.is-open").waitFor({ state: "visible" });
        await page.locator("#event-panel-close").click();
        await page.locator("#event-panel.is-open").waitFor({ state: "hidden" });

        const result = await page.evaluate(() => ({
            mapped: document.querySelector("#sentinel-map")?.dataset.filteredEvents,
            status: document.querySelector("#ops-status-text")?.textContent?.trim(),
            renderedFeatures: document.querySelector("#sentinel-map")?.dataset.renderedFeatures,
            eventCount: document.querySelector("#event-feed-count")?.textContent?.trim()
        }));
        if (!Number(result.mapped) || !Number(result.eventCount)) throw new Error("Event drawer did not expose the published event count");
        if (pageErrors.length) {
            throw new Error(`Global map emitted browser errors: ${pageErrors.join("; ")}`);
        }
        console.log(`Global map browser verification passed: ${JSON.stringify(result)}`);
    }
    finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

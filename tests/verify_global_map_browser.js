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
        if (await page.locator("#sentinel-map").getAttribute("data-feed-state") !== "available") {
            throw new Error("Loaded Sentinel publication did not report an available feed state");
        }
        await page.locator("#filter-time").selectOption("all");
        await page.waitForFunction(
            () => Number(document.querySelector("#ops-mapped")?.textContent?.replaceAll(",", "")) > 0,
            { timeout: 30000 }
        );
        await page.waitForFunction(
            () => Number(document.querySelector("#sentinel-map")?.dataset.visibleEvents) > 0,
            { timeout: 30000 }
        );

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
        await page.mouse.click(point.x, point.y);
        await page.locator(".maplibregl-popup").waitFor({ state: "visible", timeout: 5000 });
        if (await page.locator(".sentinel-popup").count() !== 1) {
            throw new Error("Located map event did not render an event popup");
        }
        if (!(await page.locator(".sentinel-popup").textContent()).includes("Source:")) {
            throw new Error("Event popup did not include source attribution");
        }
        const popupLink = page.locator(".sentinel-popup a");
        if (await popupLink.count() !== 1 || !(await popupLink.getAttribute("href"))?.startsWith("https://")) {
            throw new Error("Event popup did not include a safe original-report link");
        }

        await page.waitForFunction(
            () => ["available", "partial", "stale"].includes(
                document.querySelector("#source-viewer")?.dataset.feedState
            ) && Number(document.querySelector("#source-feed-count")?.textContent) > 0,
            { timeout: 30000 }
        );
        await page.locator("#source-viewer-open").click();
        await page.locator("#source-viewer:not([hidden])").waitFor();
        if (await page.locator("#source-viewer").getAttribute("aria-modal") !== null) {
            throw new Error("Desktop source viewer must be a non-modal dock");
        }
        if (await page.locator(".source-card").count() !== 1) {
            throw new Error("Populated source feed did not render a source card");
        }
        await page.keyboard.press("Escape");
        await page.locator("#source-viewer").waitFor({ state: "hidden" });
        if (await page.evaluate(() => document.activeElement?.id) !== "source-viewer-open") {
            throw new Error("Source viewer did not restore trigger focus");
        }

        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("#source-viewer-open").click();
        if (await page.locator("#source-viewer").getAttribute("aria-modal") !== "true") {
            throw new Error("Mobile source viewer must be modal");
        }
        const mobileBox = await page.locator("#source-viewer").boundingBox();
        if (!mobileBox || mobileBox.x > 1 || mobileBox.width < 389) {
            throw new Error("Mobile source viewer did not fill the viewport");
        }
        await page.keyboard.press("Escape");

        await page.locator("#mobile-panel-toggle").click();
        await page.locator(".control-panel.is-open").waitFor({ state: "visible" });
        await page.locator("#mobile-panel-close").click();
        await page.locator(".control-panel.is-open").waitFor({ state: "hidden" });

        const result = await page.evaluate(() => ({
            mapped: document.querySelector("#ops-mapped")?.textContent?.trim(),
            generated: document.querySelector("#ops-generated")?.textContent?.trim(),
            status: document.querySelector("#ops-status-text")?.textContent?.trim(),
            renderedFeatures: document.querySelector("#sentinel-map")?.dataset.renderedFeatures,
            sourceFeedState: document.querySelector("#source-viewer")?.dataset.feedState,
            sourceFeedCount: document.querySelector("#source-feed-count")?.textContent?.trim()
        }));
        if (!result.generated || result.generated === "Unknown") {
            throw new Error("Global map did not display a publication timestamp");
        }
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

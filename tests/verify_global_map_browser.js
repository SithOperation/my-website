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
            () => Number(document.querySelector("#ops-mapped")?.textContent?.replaceAll(",", "")) > 0,
            { timeout: 30000 }
        );
        await page.waitForFunction(
            () => Number(document.querySelector("#sentinel-map")?.dataset.renderedFeatures) > 0,
            { timeout: 30000 }
        );

        await page.waitForFunction(
            () => document.querySelector("#source-viewer")?.dataset.feedState === "unavailable",
            { timeout: 30000 }
        );
        await page.locator("#source-viewer-open").click();
        await page.locator("#source-viewer:not([hidden])").waitFor();
        if (await page.locator("#source-viewer").getAttribute("aria-modal") !== "false") {
            throw new Error("Desktop source viewer must be a non-modal dock");
        }
        if (!await page.locator("#source-viewer-status").textContent().then(text => text.includes("temporarily unavailable"))) {
            throw new Error("Unavailable source feed state was not explained");
        }
        await page.keyboard.press("Escape");
        await page.locator("#source-viewer[hidden]").waitFor();
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

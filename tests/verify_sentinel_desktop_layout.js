"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = String(process.env.LOCAL_BASE_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
const viewports = [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 }
];

async function main() {
    const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;
    const browser = await chromium.launch({ headless: true, executablePath });
    const page = await browser.newPage();

    try {
        for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            const response = await page.goto(`${baseUrl}/sentinel.html?layout=${viewport.width}`, {
                waitUntil: "domcontentloaded",
                timeout: 30000
            });
            assert.ok(response?.ok(), `${viewport.width}x${viewport.height}: page failed to load`);
            await page.waitForTimeout(500);

            const result = await page.evaluate(() => {
                const box = selector => document.querySelector(selector)?.getBoundingClientRect();
                const shell = box(".ops-shell");
                const controls = box(".control-panel");
                const mapStage = box(".map-stage");
                const mapFrame = box(".map-frame");
                const map = box("#sentinel-map");
                const intelligence = box(".event-panel");
                return {
                    viewport: { width: innerWidth, height: innerHeight },
                    document: {
                        width: document.documentElement.scrollWidth,
                        height: document.documentElement.scrollHeight
                    },
                    bodyOverflow: getComputedStyle(document.body).overflow,
                    shell,
                    controls,
                    mapStage,
                    mapFrame,
                    map,
                    intelligence
                };
            });

            const label = `${viewport.width}x${viewport.height}`;
            assert.equal(result.document.width, viewport.width, `${label}: horizontal page scrollbar`);
            assert.equal(result.document.height, viewport.height, `${label}: vertical page scrollbar`);
            assert.equal(result.bodyOverflow, "hidden", `${label}: desktop body must not scroll`);
            for (const [name, box] of Object.entries({
                shell: result.shell,
                controls: result.controls,
                mapStage: result.mapStage,
                mapFrame: result.mapFrame,
                map: result.map,
                intelligence: result.intelligence
            })) {
                assert.ok(box, `${label}: ${name} is missing`);
                assert.ok(box.width > 0 && box.height > 0, `${label}: ${name} has no rendered area`);
                assert.ok(box.left >= -1 && box.top >= -1, `${label}: ${name} starts outside viewport`);
                assert.ok(box.right <= viewport.width + 1, `${label}: ${name} exceeds viewport width`);
                assert.ok(box.bottom <= viewport.height + 1, `${label}: ${name} exceeds viewport height`);
            }
            assert.ok(result.controls.right <= result.mapStage.left, `${label}: controls overlap map`);
            assert.ok(result.mapStage.right <= result.intelligence.left, `${label}: map overlaps intelligence`);
            assert.ok(result.mapStage.width > result.controls.width * 3, `${label}: map is not dominant`);
            assert.ok(Math.abs(result.map.width - result.mapFrame.width) <= 1, `${label}: map width gap`);
            assert.ok(Math.abs(result.map.height - result.mapFrame.height) <= 1, `${label}: map height gap`);
        }
    } finally {
        await browser.close();
    }
}

main().then(
    () => console.log("Sentinel desktop layout verified at 1366x768, 1920x1080, and 2560x1440"),
    error => {
        console.error(error);
        process.exitCode = 1;
    }
);

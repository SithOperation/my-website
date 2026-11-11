"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = String(process.env.LOCAL_BASE_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
const viewports = [
    { width: 360, height: 740, mobile: true },
    { width: 390, height: 844, mobile: true },
    { width: 430, height: 932, mobile: true },
    { width: 768, height: 1024, mobile: true },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
    { width: 844, height: 390, mobile: true, landscape: true }
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
                const box = selector => {
                    const rect = document.querySelector(selector)?.getBoundingClientRect();
                    return rect ? {
                        x: rect.x,
                        y: rect.y,
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        right: rect.right,
                        bottom: rect.bottom
                    } : null;
                };
                const styles = selector => {
                    const node = document.querySelector(selector);
                    if (!node) return null;
                    const style = getComputedStyle(node);
                    return {
                        display: style.display,
                        position: style.position,
                        boxSizing: style.boxSizing,
                        width: style.width,
                        height: style.height,
                        minWidth: style.minWidth,
                        minHeight: style.minHeight,
                        padding: style.padding,
                        border: style.border,
                        outline: style.outline,
                        inset: style.inset
                    };
                };
                const shell = box(".ops-shell");
                const mapStage = box(".map-stage");
                const mapFrame = box(".map-frame");
                const map = box("#sentinel-map");
                const canvas = box(".maplibregl-canvas");
                return {
                    viewport: { width: innerWidth, height: innerHeight },
                    document: {
                        width: document.documentElement.scrollWidth,
                        height: document.documentElement.scrollHeight
                    },
                    bodyOverflow: getComputedStyle(document.body).overflow,
                    shell,
                    mapStage,
                    mapFrame,
                    map,
                    canvas,
                    styles: {
                        mapFrame: styles(".map-frame"),
                        map: styles("#sentinel-map"),
                        canvas: styles(".maplibregl-canvas")
                    },
                };
            });

            const label = `${viewport.width}x${viewport.height}`;
            assert.ok(result.document.width <= viewport.width, `${label}: horizontal page scrollbar`);
            if (!viewport.mobile) {
                assert.equal(result.document.height, viewport.height, `${label}: vertical page scrollbar`);
                assert.equal(result.bodyOverflow, "hidden", `${label}: desktop body must not scroll`);
            }
            for (const [name, box] of Object.entries({
                shell: result.shell,
                mapStage: result.mapStage,
                mapFrame: result.mapFrame,
                map: result.map
            })) {
                assert.ok(box, `${label}: ${name} is missing`);
                assert.ok(box.width > 0 && box.height > 0, `${label}: ${name} has no rendered area`);
                assert.ok(box.left >= -1 && box.top >= -1, `${label}: ${name} starts outside viewport`);
                assert.ok(box.right <= viewport.width + 1, `${label}: ${name} exceeds viewport width`);
                if (!viewport.mobile) assert.ok(box.bottom <= viewport.height + 1, `${label}: ${name} exceeds viewport height`);
            }
            assert.ok(Math.abs(result.mapFrame.x) <= 1, `${label}: map frame has a horizontal inset`);
            assert.ok(Math.abs(result.mapFrame.y) <= 1, `${label}: map frame has a vertical inset`);
            assert.ok(Math.abs(result.mapFrame.width - viewport.width) <= 1, `${label}: map frame does not fill viewport width`);
            assert.ok(Math.abs(result.mapFrame.height - viewport.height) <= 1, `${label}: map frame does not fill viewport height`);
            const geometry = JSON.stringify({
                viewport: result.viewport,
                mapFrame: result.mapFrame,
                map: result.map,
                canvas: result.canvas,
                styles: result.styles
            });
            assert.ok(Math.abs(result.map.width - result.mapFrame.width) <= 1, `${label}: map width gap ${geometry}`);
            assert.ok(Math.abs(result.map.height - result.mapFrame.height) <= 1, `${label}: map height gap ${geometry}`);
            if (result.canvas) {
                assert.ok(Math.abs(result.canvas.width - result.map.width) <= 2, `${label}: canvas width gap ${geometry}`);
                assert.ok(Math.abs(result.canvas.height - result.map.height) <= 2, `${label}: canvas height gap ${geometry}`);
            }
        }
    } finally {
        await browser.close();
    }
}

main().then(
    () => console.log("Sentinel responsive layout verified across phone, tablet, desktop, 4K, and landscape viewports"),
    error => {
        console.error(error);
        process.exitCode = 1;
    }
);

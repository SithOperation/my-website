"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const windowMock = {};
vm.runInNewContext(
    fs.readFileSync(
        path.join(__dirname, "..", "assets", "js", "sentinel-data.js"),
        "utf8"
    ),
    { window: windowMock, console, DOMParser: class {} }
);

const { GenerationFeed, isWithinRetentionWindow, mapRetentionHours } =
    windowMock.SentinelData;

function geojson(generationId, ids) {
    return {
        type: "FeatureCollection",
        generation_id: generationId,
        features: ids.map(id => ({ type: "Feature", id }))
    };
}

async function run() {
    {
        const now = Date.parse("2026-07-27T12:00:00Z");
        assert.equal(mapRetentionHours, 48);
        assert.equal(
            isWithinRetentionWindow("2026-07-25T12:00:00Z", now),
            true
        );
        assert.equal(
            isWithinRetentionWindow("2026-07-25T11:59:59Z", now),
            false
        );
        assert.equal(isWithinRetentionWindow("invalid", now), false);
    }

    {
        const calls = [];
        const responses = [
            { generation_id: "one" },
            geojson("one", ["a"]),
            { generation_id: "one" },
            { generation_id: "two" },
            geojson("two", ["b"])
        ];
        const client = {
            async fetchJSON(filename, generationId, noStore) {
                calls.push({ filename, generationId, noStore });
                return responses.shift();
            }
        };
        const feed = new GenerationFeed(client, {
            metadataFile: "events.json",
            dataFile: "points.geojson"
        });
        const first = await feed.load();
        assert.equal(first.unchanged, false);
        assert.deepEqual(first.data.features.map(feature => feature.id), ["a"]);
        const unchanged = await feed.load();
        assert.equal(unchanged.unchanged, true);
        assert.equal(calls.filter(call => call.filename === "points.geojson").length, 1);
        const changed = await feed.load();
        assert.deepEqual(changed.data.features.map(feature => feature.id), ["b"]);
    }

    {
        const responses = [
            { generation_id: "new" },
            geojson("old", ["stale"]),
            geojson("new", ["fresh"])
        ];
        const calls = [];
        const client = {
            async fetchJSON(filename, generationId, noStore) {
                calls.push({ filename, generationId, noStore });
                return responses.shift();
            }
        };
        const feed = new GenerationFeed(client, {
            metadataFile: "events.json",
            dataFile: "points.geojson"
        });
        const result = await feed.load();
        assert.deepEqual(result.data.features.map(feature => feature.id), ["fresh"]);
        assert.equal(calls[2].noStore, true);
    }

    {
        const responses = [
            { generation_id: "broken" },
            geojson("old", []),
            geojson("old", [])
        ];
        const feed = new GenerationFeed(
            { async fetchJSON() { return responses.shift(); } },
            { metadataFile: "events.json", dataFile: "points.geojson" }
        );
        await assert.rejects(feed.load(), /does not match generation/);
        assert.equal(feed.generationId, null);
    }

    const mapSource = fs.readFileSync(
        path.join(__dirname, "..", "assets", "js", "sentinel-map.js"),
        "utf8"
    );
    assert.equal(
        (mapSource.match(/map\.addSource\("x-early-reports-source"/g) || []).length,
        1
    );
    assert.equal(
        (mapSource.match(/map\.on\("click", "x-early-reports"/g) || []).length,
        1
    );
    assert.match(mapSource, /getSource\("x-early-reports-source"\)\.setData/);
    assert.match(mapSource, /document\.visibilityState === "visible"/);
    assert.match(mapSource, /retainRecentEvents/);
    assert.match(mapSource, /retainedEarlyReportGeojson/);
    const mapPage = fs.readFileSync(
        path.join(__dirname, "..", "sentinel.html"),
        "utf8"
    );
    assert.doesNotMatch(mapPage, /value="72"/);
    assert.doesNotMatch(mapPage, /value="168"/);

    console.log("X generation refresh tests passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

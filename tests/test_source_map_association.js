"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let reducedMotion = false;
const windowMock = {
    SentinelData: {
        Client: class {},
        GenerationFeed: class {}
    },
    matchMedia: query => ({
        matches: query.includes("prefers-reduced-motion") && reducedMotion
    }),
    addEventListener() {}
};
const context = {
    console,
    Date,
    Map,
    Math,
    Number,
    Object,
    Option: class {},
    Set,
    URL,
    document: {
        addEventListener() {},
        getElementById() { return null; },
        visibilityState: "visible"
    },
    setInterval() {},
    window: windowMock
};
const scriptPath = path.join(__dirname, "..", "assets", "js", "sentinel-map.js");
vm.runInNewContext(fs.readFileSync(scriptPath, "utf8"), context, { filename: scriptPath });

const association = windowMock.SentinelMapAssociation;
assert.ok(association, "map association helpers must be exposed");

const featureStates = [];
const movements = [];
const mapMock = {
    setFeatureState(target, state) {
        featureStates.push({ target, state });
    },
    easeTo(options) {
        movements.push(options);
    },
    getZoom() {
        return 3;
    }
};
const events = new Map([
    ["evt_1", { event_id: "evt_1", latitude: 49.99, longitude: 36.23 }],
    ["evt_2", { event_id: "evt_2", latitude: 50.45, longitude: 30.52 }]
]);

assert.equal(association.locateSourceEvent("missing", mapMock, events, true, false), false);
assert.equal(association.locateSourceEvent("evt_1", mapMock, events, true, false), true);
assert.equal(featureStates.at(-1).target.source, "sentinel-events");
assert.equal(featureStates.at(-1).target.id, "evt_1");
assert.equal(featureStates.at(-1).state.sourceHighlight, true);
assert.equal(JSON.stringify(movements.at(-1).center), JSON.stringify([36.23, 49.99]));
assert.equal(movements.at(-1).duration, 450);

assert.equal(association.locateSourceEvent("evt_2", mapMock, events, true, false), true);
assert.equal(featureStates.at(-2).target.id, "evt_1");
assert.equal(featureStates.at(-2).state.sourceHighlight, false);
assert.equal(featureStates.at(-1).target.id, "evt_2");
assert.equal(featureStates.at(-1).state.sourceHighlight, true);

reducedMotion = true;
association.locateSourceEvent("evt_1", mapMock, events, true, false);
assert.equal(movements.at(-1).duration, 0);
association.clearSourceHighlight(mapMock, true);
assert.equal(featureStates.at(-1).state.sourceHighlight, false);

assert.equal(association.isSourceReported({ location_status: "source_reported" }), true);
assert.equal(association.isSourceReported({ claim_status: "unverified" }), true);
assert.equal(association.isSourceReported({ claim_status: "verified" }), false);

const mapScript = fs.readFileSync(scriptPath, "utf8");
assert.ok(mapScript.includes('id: "source-reported-halo"'));
assert.ok(mapScript.includes('id: "association-highlight"'));
assert.ok(!mapScript.includes("new window.maplibregl.Marker"));

console.log("Source/map association tests passed");

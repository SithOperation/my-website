"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.children = [];
        this.textContent = "";
        this.className = "";
    }

    append(...children) {
        this.children.push(...children);
    }
}

function textNode(value) {
    return { nodeType: 3, textContent: String(value) };
}

function allText(node) {
    return [node.textContent, ...(node.children || []).flatMap(allText)]
        .filter(Boolean)
        .join(" ");
}

function allElements(node) {
    return [node, ...(node.children || []).flatMap(allElements)];
}

const windowMock = {
    SentinelData: { Client: class {} },
    addEventListener() {}
};
const context = {
    console,
    Date,
    Map,
    Number,
    Object,
    URL,
    document: {
        addEventListener() {},
        createElement: tagName => new FakeElement(tagName),
        createTextNode: textNode
    },
    setInterval() {},
    window: windowMock
};
const scriptPath = path.join(__dirname, "..", "assets", "js", "sentinel-map.js");
vm.runInNewContext(fs.readFileSync(scriptPath, "utf8"), context, {
    filename: scriptPath
});

const popup = windowMock.SentinelXReportPopup;
assert.ok(popup, "popup helpers must be exposed for executable tests");

const complete = popup.buildEarlyReportDetail({
    account: "OSINTWarfare",
    summary: "<script>alert('not markup')</script>",
    published_at: "2026-07-26T14:00:00Z",
    location_name: "Example City",
    event_type: "reported_military_activity",
    source_class: "social_media_osint",
    verification_status: "not_independently_verified",
    confidence: 0.756,
    location_precision: "city",
    source_url: "https://x.com/OSINTWarfare/status/1888888888888888888"
});
const completeText = allText(complete);
[
    "Account:",
    "@OSINTWarfare",
    "Summary:",
    "<script>alert('not markup')</script>",
    "First reported:",
    "Location:",
    "Example City",
    "Event type:",
    "Source classification:",
    "Verification:",
    "Confidence:",
    "75.6%",
    "Location precision:",
    "View original report"
].forEach(value => assert.ok(completeText.includes(value), `missing popup text: ${value}`));
assert.equal(
    allElements(complete).filter(element => element.tagName === "script").length,
    0,
    "summary text must not create script elements"
);

const missing = popup.buildEarlyReportDetail({
    account: "",
    summary: "Summary",
    published_at: "invalid",
    location_name: "",
    event_type: "",
    source_class: "",
    verification_status: "",
    confidence: null,
    location_precision: "",
    source_url: "javascript:alert(1)"
});
const missingText = allText(missing);
assert.ok(!missingText.includes("undefined"));
assert.ok(!missingText.includes("null"));
assert.equal(
    allElements(missing).filter(element => element.tagName === "a").length,
    0,
    "malformed URLs must not create links"
);

assert.equal(popup.formatEarlyReportAccount("@@MonitorX99800"), "@MonitorX99800");
assert.equal(popup.formatEarlyReportAccount(null), "");
assert.equal(popup.formatEarlyReportConfidence(0), "0%");
assert.equal(popup.formatEarlyReportConfidence(1), "100%");
assert.equal(popup.formatEarlyReportConfidence("bad"), "");
assert.equal(popup.formatEarlyReportTimestamp("not-a-date"), "");
assert.ok(popup.formatEarlyReportTimestamp("2026-07-26T14:00:00Z"));
assert.equal(
    popup.safeOriginalXUrl("https://x.com/a/status/1?tracking=true"),
    ""
);
assert.equal(
    popup.safeOriginalXUrl("https://example.com/a/status/1"),
    ""
);

console.log("X report popup tests passed");

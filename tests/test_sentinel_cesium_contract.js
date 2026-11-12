const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "sentinel-cesium.html"), "utf8");
const script = fs.readFileSync(path.join(root, "assets", "js", "sentinel-cesium.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "assets", "css", "sentinel-cesium.css"), "utf8");

assert.match(page, /SCENE2D|Cesium\/Cesium\.js/);
assert.match(page, /sentinel-data\.js/);
assert.match(script, /scene\.pick/);
assert.match(script, /flyTo/);
assert.match(script, /fromDegrees/);
assert.match(script, /event_id/);
assert.match(script, /removeAll/);
assert.match(styles, /100dvh/);
assert.match(styles, /safe-area-inset/);
console.log("Cesium prototype contract passed");

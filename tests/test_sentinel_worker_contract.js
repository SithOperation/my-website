const fs = require("node:fs");
const assert = require("node:assert/strict");

const worker = fs.readFileSync("cloudflare/sentinel-api.js", "utf8");
const migration = fs.readFileSync("cloudflare/migrations/0002_intelligence_evidence.sql", "utf8");

for (const cron of [
  "*/5 * * * *",
  "*/10 * * * *",
  "*/15 * * * *",
  "0,30 * * * *",
  "5,15,25,35,45,55 * * * *"
]) {
  assert.ok(worker.includes(`case "${cron}"`), `missing cron trigger: ${cron}`);
}

for (const sourceId of [
  "bbc-world-rss", "dw-world-rss", "guardian-world-rss", "al-jazeera-world-rss",
  "meduza-english-rss", "38north-rss", "err-news-rss", "yonhap-english-rss",
  "nhk-news-rss", "irna-english-rss", "mehrnews-english-rss", "radio-farda-rss",
  "cisa-advisories-rss", "usgs-earthquakes", "noaa-space-weather-json", "gdacs",
  "cisa-kev", "gdelt"
]) {
  assert.match(worker, new RegExp(sourceId));
}

assert.match(worker, /path === "\/api\/live-events"/);
assert.match(worker, /path === "\/api\/news"/);
assert.match(worker, /path === "\/api\/import"/);
assert.match(worker, /env\.IMPORT_SECRET/);
for (const table of ["sources", "incidents", "incident_sources", "claims", "evidence", "article_intelligence", "classification_history"]) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
console.log("Sentinel Worker contract passed");

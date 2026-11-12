# Sentinel API Worker

`sentinel-api.js` is the Cloudflare module Worker that writes verified public
source records into the Sentinel D1 database and serves the website API.

Required configuration:

- D1 binding: `DB`
- Secret: `IMPORT_SECRET` (used only by the protected `/api/import` endpoint)
- Do not commit secret values to this repository.

Configure exactly these five Cron Triggers in the Worker:

```text
*/5 * * * *
*/10 * * * *
*/15 * * * *
0,30 * * * *
5,15,25,35,45,55 * * * *
```

The fifth trigger rotates the registry RSS sources between groups A and B.
Optional `GOV_RSS_FEEDS` and `MARITIME_AVIATION_RSS_FEEDS` variables accept
JSON arrays of verified feed records, but are not required for the public
registry sources.

Deploy this file through the Cloudflare Worker dashboard or Wrangler, then
verify `/api/status`, `/api/database-health`, `/api/collector-health`,
`/api/live-events`, and `/api/news` before considering the live feed updated.

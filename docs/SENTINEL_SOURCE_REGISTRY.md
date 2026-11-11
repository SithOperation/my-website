# Sentinel free-source registry

`config/sentinel_sources.json` is the allowlist for the optional free-source
collector. It contains only structured HTTPS endpoints that were checked on
2026-11-11. The collector uses headlines, short summaries, attribution, and
links; it does not copy article bodies.

The collector publishes `data/sentinel_news.json`, which is a feed-only
publication. It is intentionally separate from the authoritative
`data/map_events.json` publication synchronized from
`SithOperation/sentinel-grid-intelligence`.

## Current audit

| Source | Coverage | Endpoint | Format | Access verified | Auth | Enabled | Notes |
|---|---|---|---|---|---|---|---|
| GDELT Project | Global | `https://api.gdeltproject.org/api/v2/doc/doc?query=world&mode=artlist&format=json&maxrecords=50` | JSON | Yes, HTTP 200 | None | Yes | Metadata index; original links only |
| BBC News | Global, including priority-country mentions | `https://feeds.bbci.co.uk/news/world/rss.xml` | RSS | Yes, HTTP 200 | None | Yes | Headlines/summaries/links only |
| Deutsche Welle | Global, Germany | `https://rss.dw.com/xml/rss-en-all` | RSS | Yes, HTTP 200 | None | Yes | Headlines/summaries/links only |
| The Guardian | Global | `https://www.theguardian.com/world/rss` | RSS | Yes, HTTP 200 | None | Yes | Headlines/summaries/links only |
| Al Jazeera | Global | `https://www.aljazeera.com/xml/rss/all.xml` | RSS | Yes, HTTP 200 | None | Yes | Headlines/summaries/links only |
| Meduza | Russia / Eastern Europe | `https://meduza.io/rss/en/all` | RSS | Yes, HTTP 200 | None | Yes | Independent publisher; claims attributed |
| 38 North | North Korea | `https://www.38north.org/feed/` | RSS | Yes, HTTP 200 | None | Yes | Specialist analysis, not event confirmation |
| ERR News | Estonia | `https://news.err.ee/rss` | RSS | Yes, HTTP 200 | None | Yes | Public broadcaster feed |
| Yonhap News Agency | South Korea | `https://en.yna.co.kr/RSS/news.xml` | RSS | Yes, HTTP 200 | None | Yes | National news agency feed |
| NHK | Japan | `https://www3.nhk.or.jp/rss/news/cat0.xml` | RSS | Yes, HTTP 200 | None | Yes | Japanese-language feed |
| IRNA English | Iran | `https://en.irna.ir/rss` | RSS | Yes, HTTP 200 | None | Yes | State news agency; claims attributed |
| Mehr News English | Iran | `https://en.mehrnews.com/rss` | RSS | Yes, HTTP 200 | None | Yes | State-linked agency; claims attributed |
| Radio Farda | Iran | `https://www.radiofarda.com/api/` | RSS/XML | Yes, HTTP 200 | None | Yes | International broadcaster; claims attributed |
| CISA advisories | Global infrastructure | `https://www.cisa.gov/cybersecurity-advisories/all.xml` | RSS | Yes, HTTP 200 | None | Yes | Official advisory metadata and links |
| USGS earthquakes | Global | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson` | GeoJSON | Yes, HTTP 200 | None | Yes | Source coordinates are preserved |
| NOAA SWPC | Global space weather | `https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json` | JSON | Yes, HTTP 200 | None | Yes | Telemetry; not treated as news |

The 11 priority countries are represented in the registry's country list and
the classifier can tag mentions for Iran, Lithuania, Poland, Germany, Estonia,
Russia, China, South Korea, North Korea, Taiwan, and Japan. This is mention
coverage, not a claim that every country has comprehensive local reporting.
Country-specific feeds remain disabled until a legitimate machine-readable
endpoint and its usage terms are verified.

## Safety and extension rules

- A feed item without source-supplied coordinates stays in the news feed and
  never receives a capital-city or `(0, 0)` marker.
- A source outage produces a per-source degraded health record; it does not
  discard other sources or stop publication.
- Conditional `ETag` and `Last-Modified` requests avoid downloading unchanged
  responses when providers support them.
- HTTP timeouts, bounded retries, `Retry-After`, and bounded concurrency are
  enforced by `collectors/sentinel_sources.py`.
- Add a source only after checking its actual RSS/Atom/JSON/GeoJSON endpoint,
  access requirements, rate limits, and redistribution restrictions. Do not
  substitute a website homepage for a feed endpoint.
- Credentials are not stored in the registry. Sources requiring credentials
  remain disabled until a separate secret-backed adapter is approved.

The scheduled workflow `.github/workflows/sync-sentinel-news.yml` runs every
30 minutes on the free GitHub Actions allowance. It writes only the feed and
its conditional-request state, and does not compete with the authoritative
Sentinel publication workflow.

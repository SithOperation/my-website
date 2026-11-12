// Sentinel multi-source Worker.
// Cloudflare module Worker. Required D1 binding: DB.
// Required secret: IMPORT_SECRET. Never commit secret values.

const UPSTREAM = "https://sithoperation.github.io/my-website/data/map_events.json";
const USGS = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const NOAA = "https://api.weather.gov/alerts/active";
const NOAA_SWPC = "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json";
const GDACS = "https://www.gdacs.org/xml/rss.xml";
const CISA_KEV = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const CISA_ADVISORIES = "https://www.cisa.gov/cybersecurity-advisories/all.xml";
const GDELT = "https://api.gdeltproject.org/api/v2/doc/doc";

// These are public endpoints from config/sentinel_sources.json. They are
// split into two groups and rotated on one Cron Trigger to stay within the
// five-trigger limit while keeping each group small enough for the free plan.
const NEWS_RSS_A = [
  ["bbc-world-rss", "BBC News", "https://feeds.bbci.co.uk/news/world/rss.xml", ["news", "international", "politics"]],
  ["dw-world-rss", "Deutsche Welle", "https://rss.dw.com/xml/rss-en-all", ["news", "international", "politics"]],
  ["guardian-world-rss", "The Guardian", "https://www.theguardian.com/world/rss", ["news", "international", "politics"]],
  ["al-jazeera-world-rss", "Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", ["news", "international", "politics"]],
  ["meduza-english-rss", "Meduza", "https://meduza.io/rss/en/all", ["news", "Russia", "politics"]],
  ["38north-rss", "38 North", "https://www.38north.org/feed/", ["analysis", "North Korea", "security"]],
  ["err-news-rss", "ERR News", "https://news.err.ee/rss", ["news", "Estonia", "security"]]
];
const NEWS_RSS_B = [
  ["yonhap-english-rss", "Yonhap News Agency", "https://en.yna.co.kr/RSS/news.xml", ["news", "South Korea", "security"]],
  ["nhk-news-rss", "NHK", "https://www3.nhk.or.jp/rss/news/cat0.xml", ["news", "Japan", "international"]],
  ["irna-english-rss", "Islamic Republic News Agency", "https://en.irna.ir/rss", ["news", "Iran", "politics"]],
  ["mehrnews-english-rss", "Mehr News Agency", "https://en.mehrnews.com/rss", ["news", "Iran", "politics"]],
  ["radio-farda-rss", "Radio Farda", "https://www.radiofarda.com/api/", ["news", "Iran", "politics"]],
  ["cisa-advisories-rss", "Cybersecurity and Infrastructure Security Agency", CISA_ADVISORIES, ["cybersecurity", "infrastructure", "advisory"]]
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { ...CORS, "Cache-Control": "no-store" }
});

const iso = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const text = (value, maximum = 1000) => String(value ?? "")
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);

const validCoords = (latitude, longitude) => Number.isFinite(latitude) &&
  Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
  !(latitude === 0 && longitude === 0);

const stableId = (prefix, value) => `${prefix}-${String(value).slice(0, 300)}`;

const escXml = value => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");

const xmlTag = (xml, name) => escXml(
  xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || ""
);

function rssItems(xml) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .map(match => ({
      title: text(xmlTag(match[1], "title"), 220),
      description: text(xmlTag(match[1], "description"), 800),
      url: text(xmlTag(match[1], "link"), 1500),
      date: iso(xmlTag(match[1], "pubDate"))
    }))
    .filter(item => item.title && /^https:\/\//i.test(item.url))
    .slice(0, 70);
}

async function fetchSource(url, accept = "application/json") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: accept,
        "User-Agent": "SentinelDashboard/1.0 (public monitoring project)"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function recordHealth(db, id, status, count, error = null) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO collector_health(source_id,status,last_attempt,last_success,last_error,records_received)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(source_id) DO UPDATE SET
      status=excluded.status,
      last_attempt=excluded.last_attempt,
      last_success=CASE WHEN excluded.status='healthy' THEN excluded.last_success ELSE collector_health.last_success END,
      last_error=excluded.last_error,
      records_received=excluded.records_received
  `).bind(
    id,
    status,
    now,
    status === "healthy" ? now : null,
    error ? String(error).slice(0, 450) : null,
    count
  ).run();
}

async function runCollector(env, id, collector) {
  if (!env.DB) throw new Error("Missing DB binding");
  try {
    const count = await collector(env.DB, env);
    await recordHealth(env.DB, id, "healthy", count);
    console.log(id, "processed", count);
  } catch (error) {
    console.error(id, error);
    try {
      await recordHealth(env.DB, id, "failed", 0, error.message || error);
    } catch (healthError) {
      console.error("Health write failed", healthError);
    }
  }
}

async function upsertEvents(db, records) {
  let count = 0;
  for (let offset = 0; offset < records.length; offset += 15) {
    const statements = records.slice(offset, offset + 15)
      .filter(item => item.id && item.title && validCoords(item.lat, item.lon) && item.timestamp)
      .map(item => db.prepare(`
        INSERT INTO events(event_id,title,description,category,severity,latitude,longitude,source,source_url,verification_status,event_timestamp,collected_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(event_id) DO UPDATE SET
          title=excluded.title, description=excluded.description, category=excluded.category,
          severity=excluded.severity, latitude=excluded.latitude, longitude=excluded.longitude,
          source=excluded.source, source_url=excluded.source_url, event_timestamp=excluded.event_timestamp,
          updated_at=excluded.updated_at
        WHERE events.title IS NOT excluded.title OR events.description IS NOT excluded.description OR
          events.category IS NOT excluded.category OR events.severity IS NOT excluded.severity OR
          events.latitude IS NOT excluded.latitude OR events.longitude IS NOT excluded.longitude OR
          events.source IS NOT excluded.source OR events.source_url IS NOT excluded.source_url OR
          events.event_timestamp IS NOT excluded.event_timestamp
      `).bind(
        item.id, item.title, item.description || null, item.category,
        item.severity || "UNKNOWN", item.lat, item.lon, item.source,
        item.url || null, "source_reported", item.timestamp,
        new Date().toISOString(), new Date().toISOString()
      ));
    if (statements.length) {
      await db.batch(statements);
      count += statements.length;
    }
  }
  return count;
}

async function upsertNews(db, items) {
  let count = 0;
  for (let offset = 0; offset < items.length; offset += 15) {
    const statements = items.slice(offset, offset + 15)
      .filter(item => item.id && item.title && /^https:\/\//i.test(item.url))
      .map(item => db.prepare(`
        INSERT INTO news_articles(article_id,title,summary,category,source_id,publisher,url,countries,published_at,collected_at,updated_at,verification_status)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,'source_reported')
        ON CONFLICT(article_id) DO UPDATE SET
          title=excluded.title, summary=excluded.summary, published_at=excluded.published_at,
          updated_at=excluded.updated_at
        WHERE news_articles.title IS NOT excluded.title OR
          news_articles.summary IS NOT excluded.summary OR
          news_articles.published_at IS NOT excluded.published_at
      `).bind(
        item.id,
        text(item.title, 220),
        text(item.summary, 800),
        item.category,
        item.sourceId,
        item.publisher || item.sourceId,
        item.url,
        JSON.stringify(item.countries || []),
        item.published || null,
        new Date().toISOString(),
        new Date().toISOString()
      ));
    if (statements.length) {
      await db.batch(statements);
      count += statements.length;
    }
  }
  return count;
}

async function collectUSGS(db) {
  const data = await (await fetchSource(USGS)).json();
  if (!Array.isArray(data.features)) throw new Error("Invalid USGS features");
  const rows = data.features.slice(0, 250).map(feature => {
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [];
    const magnitude = Number(properties.mag);
    return {
      id: stableId("USGS", feature.id),
      title: properties.title || "Earthquake",
      description: properties.place || "",
      category: "earthquake",
      severity: Number.isFinite(magnitude) ? magnitude >= 6 ? "CRITICAL" : magnitude >= 5 ? "HIGH" : magnitude >= 4 ? "MEDIUM" : "LOW" : "UNKNOWN",
      lat: coordinates[1], lon: coordinates[0],
      source: "USGS Earthquake Hazards Program",
      url: properties.url,
      timestamp: Number.isFinite(properties.time) ? iso(properties.time) : null
    };
  });
  return upsertEvents(db, rows);
}

async function collectNOAA(db) {
  const data = await (await fetchSource(NOAA, "application/geo+json, application/json")).json();
  if (!Array.isArray(data.features)) throw new Error("Invalid NOAA features");
  const rows = [];
  const news = [];
  for (const feature of data.features.slice(0, 250)) {
    const properties = feature.properties || {};
    const id = stableId("NOAA", properties.id || feature.id || properties["@id"]);
    if (!properties.headline && !properties.event) continue;
    const base = {
      id,
      title: properties.headline || properties.event,
      summary: properties.description || properties.instruction || "",
      category: "weather_alert",
      sourceId: "noaa-alerts",
      publisher: "US National Weather Service",
      url: properties["@id"] || properties.id || "https://www.weather.gov/",
      published: iso(properties.sent || properties.effective)
    };
    news.push(base);
    // Polygon and null geometries remain advisories; no point is fabricated.
    if (feature.geometry?.type === "Point" && validCoords(feature.geometry.coordinates?.[1], feature.geometry.coordinates?.[0])) {
      rows.push({
        ...base,
        description: base.summary,
        severity: properties.severity === "Extreme" ? "CRITICAL" : properties.severity === "Severe" ? "HIGH" : "MEDIUM",
        lat: feature.geometry.coordinates[1], lon: feature.geometry.coordinates[0], source: base.publisher,
        timestamp: base.published
      });
    }
  }
  await upsertEvents(db, rows);
  return upsertNews(db, news);
}

async function collectSpaceWeather(db) {
  const data = await (await fetchSource(NOAA_SWPC)).json();
  const record = Array.isArray(data) ? data.at(-1) : data;
  const timestamp = iso(record?.time_tag || record?.timestamp || new Date().toISOString());
  if (!record || !timestamp) throw new Error("Invalid NOAA SWPC summary");
  return upsertNews(db, [{
    id: stableId("NOAA-SWPC", timestamp),
    title: "NOAA Space Weather Solar Wind Summary",
    summary: text(JSON.stringify(record), 800),
    category: "space_weather",
    sourceId: "noaa-space-weather-json",
    publisher: "NOAA Space Weather Prediction Center",
    url: "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json",
    published: timestamp
  }]);
}

async function collectGDACS(db) {
  const xml = await (await fetchSource(GDACS, "application/rss+xml, application/xml, text/xml")).text();
  const items = rssItems(xml);
  if (!items.length) throw new Error("No GDACS RSS items parsed");
  return upsertNews(db, items.map(item => ({
    id: stableId("GDACS", item.url), title: item.title, summary: item.description,
    category: "natural_disaster", sourceId: "gdacs", publisher: "GDACS", url: item.url, published: item.date
  })));
}

async function collectCISA(db) {
  const data = await (await fetchSource(CISA_KEV)).json();
  if (!Array.isArray(data.vulnerabilities)) throw new Error("Invalid CISA KEV feed");
  return upsertNews(db, data.vulnerabilities.slice(-250).map(item => ({
    id: stableId("CISA-KEV", item.cveID),
    title: `${item.cveID}: ${item.vendorProject || ""} ${item.product || ""}`.trim(),
    summary: item.shortDescription || "", category: "cyber_advisory", sourceId: "cisa-kev",
    publisher: "CISA Known Exploited Vulnerabilities",
    url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    published: iso(item.dateAdded)
  })));
}

async function collectGDELT(db) {
  const query = '(Iran OR Lithuania OR Poland OR Germany OR Estonia OR Russia OR China OR Taiwan OR Japan OR "South Korea" OR "North Korea")';
  const params = new URLSearchParams({ query, mode: "ArtList", format: "json", maxrecords: "75", timespan: "1d", sort: "DateDesc" });
  const data = await (await fetchSource(`${GDELT}?${params}`)).json();
  if (!Array.isArray(data.articles)) throw new Error("GDELT response has no articles");
  return upsertNews(db, data.articles.map(article => ({
    id: stableId("GDELT", article.url), title: article.title, summary: "",
    category: "international_news", sourceId: "gdelt", publisher: article.domain || "GDELT indexed publisher",
    url: article.url, published: iso(article.seendate?.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z"))
  })));
}

async function collectNewsGroup(db, feeds) {
  for (const [id, publisher, url, categories] of feeds) {
    try {
      const xml = await (await fetchSource(url, "application/rss+xml, application/xml, text/xml")).text();
      const items = rssItems(xml);
      if (!items.length) throw new Error("No RSS items parsed");
      const count = await upsertNews(db, items.map(item => ({
        id: stableId(id, item.url), title: item.title, summary: item.description,
        category: categories[0] || "news", sourceId: id, publisher, url: item.url,
        published: item.date, countries: categories.slice(1)
      })));
      await recordHealth(db, id, "healthy", count);
    } catch (error) {
      await recordHealth(db, id, "failed", 0, error.message || error);
      console.error(id, error);
    }
  }
}

function configuredFeeds(env, key) {
  if (!env[key]) return [];
  const value = JSON.parse(env[key]);
  if (!Array.isArray(value)) throw new Error(`${key} must be a JSON array`);
  return value.filter(item => item && typeof item.url === "string" && /^https:\/\//.test(item.url) && typeof item.id === "string").slice(0, 12);
}

async function collectConfiguredRSS(env, key, sourceId, category) {
  if (!env[key]) {
    await recordHealth(env.DB, sourceId, "disabled", 0, "No verified RSS feeds configured");
    return;
  }
  const feeds = configuredFeeds(env, key);
  for (const feed of feeds) {
    await collectNewsGroup(env.DB, [[feed.id, feed.publisher || feed.id, feed.url, [category, ...(feed.countries || [])]]]);
  }
}

async function cleanupOldRecords(env) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const retentionStart = "2026-11-12T09:00:00.000Z";
  await env.DB.prepare(`DELETE FROM events WHERE event_id IN (SELECT event_id FROM events WHERE collected_at >= ? AND collected_at < ? AND (event_id LIKE 'USGS-%' OR event_id LIKE 'NOAA-%') LIMIT 100)`).bind(retentionStart, cutoff).run();
  await env.DB.prepare(`DELETE FROM news_articles WHERE article_id IN (SELECT article_id FROM news_articles WHERE collected_at >= ? AND collected_at < ? LIMIT 100)`).bind(retentionStart, cutoff).run();
}

async function scheduledJob(controller, env) {
  switch (controller.cron) {
    // Exactly five Cron Triggers.
    case "*/5 * * * *":
      await runCollector(env, "usgs-earthquakes", collectUSGS);
      break;
    case "*/10 * * * *":
      await runCollector(env, "noaa-alerts", collectNOAA);
      await runCollector(env, "noaa-space-weather", collectSpaceWeather);
      break;
    case "*/15 * * * *":
      await runCollector(env, "gdacs", collectGDACS);
      break;
    case "0,30 * * * *":
      await runCollector(env, "cisa-kev", collectCISA);
      await runCollector(env, "gdelt", collectGDELT);
      if (controller.scheduledTime && new Date(controller.scheduledTime).getUTCHours() === 0 && new Date(controller.scheduledTime).getUTCMinutes() === 0) {
        try { await cleanupOldRecords(env); } catch (error) { console.error("Sentinel cleanup failed", error); }
      }
      break;
    case "5,15,25,35,45,55 * * * *": {
      const minute = new Date(controller.scheduledTime || Date.now()).getUTCMinutes();
      const group = [5, 25, 45].includes(minute) ? NEWS_RSS_A : NEWS_RSS_B;
      await collectNewsGroup(env.DB, group);
      await collectConfiguredRSS(env, "GOV_RSS_FEEDS", "government-rss", "government_advisory");
      await collectConfiguredRSS(env, "MARITIME_AVIATION_RSS_FEEDS", "maritime-aviation-rss", "transport_advisory");
      break;
    }
    default:
      console.warn("Unrecognized Sentinel Cron trigger:", controller.cron);
  }
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(scheduledJob(controller, env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (path === "/api/status") return request.method === "GET" ? json({ service: "Sentinel Grid API", status: "online", timestamp: new Date().toISOString() }) : json({ error: "Method not allowed" }, 405);
    if (path === "/api/database-health") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      try { const result = await env.DB.prepare("SELECT COUNT(*) AS total FROM events").first(); return json({ service: "Sentinel Database", status: "connected", total_events: result?.total ?? 0, timestamp: new Date().toISOString() }); } catch { return json({ status: "error" }, 503); }
    }
    if (path === "/api/collector-health") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      try { const result = await env.DB.prepare("SELECT * FROM collector_health ORDER BY last_attempt DESC LIMIT 50").all(); return json({ status: "online", collectors: result.results }); } catch { return json({ error: "Collector health unavailable" }, 503); }
    }
    if (path === "/api/events") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      try { const response = await fetch(UPSTREAM, { cf: { cacheTtl: 60, cacheEverything: true } }); if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`); return new Response(response.body, { headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } }); } catch { return json({ error: "Events unavailable" }, 503); }
    }
    if (path === "/api/live-events") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      try { const result = await env.DB.prepare("SELECT event_id,title,description,category AS type,severity AS threat_level,latitude,longitude,source,source_url AS url,verification_status,event_timestamp AS timestamp,updated_at FROM events WHERE latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 ORDER BY event_timestamp DESC LIMIT 500").all(); const events = result.results.map(event => ({ ...event, confidence: null, source: event.source ? [event.source] : [] })); return json({ service: "Sentinel Live Events", status: "online", count: events.length, generated_at: new Date().toISOString(), events }); } catch { return json({ status: "error", message: "Unable to retrieve live events" }, 503); }
    }
    if (path === "/api/news") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      try { const category = url.searchParams.get("category"); const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100)); const result = category ? await env.DB.prepare("SELECT * FROM news_articles WHERE category=? ORDER BY published_at DESC LIMIT ?").bind(category, limit).all() : await env.DB.prepare("SELECT * FROM news_articles ORDER BY published_at DESC LIMIT ?").bind(limit).all(); return json({ status: "online", count: result.results.length, items: result.results.map(item => ({ ...item, countries: JSON.parse(item.countries || "[]") })) }); } catch { return json({ error: "News unavailable" }, 503); }
    }
    if (path === "/api/import") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      if (!env.IMPORT_SECRET || request.headers.get("Authorization") !== `Bearer ${env.IMPORT_SECRET}`) return json({ error: "Unauthorized" }, 401);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) return json({ error: "Invalid offset" }, 400);
      try {
        const response = await fetch(UPSTREAM, { cf: { cacheTtl: 60, cacheEverything: true } });
        if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
        const events = await response.json();
        if (!Array.isArray(events)) throw new Error("Invalid event publication");
        const batch = events.slice(offset, offset + 20);
        const now = new Date().toISOString();
        const statements = batch
          .filter(item => typeof item.event_id === "string" && item.event_id && typeof item.title === "string" && item.title)
          .map(item => env.DB.prepare(`
            INSERT INTO events(event_id,title,description,category,severity,latitude,longitude,source,source_url,verification_status,event_timestamp,collected_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(event_id) DO UPDATE SET
              title=excluded.title, description=excluded.description, category=excluded.category,
              severity=excluded.severity, latitude=excluded.latitude, longitude=excluded.longitude,
              source=excluded.source, source_url=excluded.source_url, event_timestamp=excluded.event_timestamp,
              updated_at=excluded.updated_at
          `).bind(
            item.event_id,
            item.title,
            item.description ?? null,
            item.type ?? "unknown",
            item.threat_level ?? "UNKNOWN",
            typeof item.latitude === "number" ? item.latitude : null,
            typeof item.longitude === "number" ? item.longitude : null,
            Array.isArray(item.source) ? item.source.join(", ") : String(item.source ?? ""),
            item.url ?? null,
            "unverified",
            item.timestamp ?? null,
            now,
            now
          ));
        if (statements.length) await env.DB.batch(statements);
        return json({
          status: "success",
          processed: statements.length,
          total: events.length,
          offset,
          next_offset: offset + 20 < events.length ? offset + 20 : null
        });
      } catch (error) {
        console.error("Import failed", error);
        return json({ error: "Import failed" }, 503);
      }
    }
    return json({ error: "Not found" }, 404);
  }
};

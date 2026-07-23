# Sentinel URL Inspector — Phase 1 Worker

Defensive Cloudflare Worker that checks a submitted HTTP(S) URL against Google
Safe Browsing without visiting, rendering, downloading, or otherwise fetching
the submitted site.

The provider adapter uses the Google Safe Browsing v5
[`urls.search`](https://developers.google.com/safe-browsing/reference/rest/v5/urls/search)
contract. It sends one normalized URL as a repeated `urls` query parameter in a
bodyless server-side GET request. Provider cache durations are validated and
retained as internal adapter metadata for future standards-compliant caching;
Phase 1 does not persist provider results.

## Security behavior

- `POST /api/url-check` accepts exactly `{ "url": "https://example.com" }`.
- Request bodies are limited to 4 KB and URLs to 2,048 characters.
- Native `URL` parsing is followed by explicit rejection of credentials,
  control characters, localhost, non-public IP ranges, metadata endpoints, and
  ambiguous numeric IP forms.
- Fragments are removed before hashing and provider lookup.
- Only Google Safe Browsing is contacted. Provider timeouts and failures return
  `unavailable`, never a clean result.
- URL and rate-limit identifiers use HMAC-SHA-256 with `APP_HASH_SECRET`.
- CORS permits only `https://sithbusiness.com` and
  `https://www.sithbusiness.com`.
- The native Cloudflare rate limiter permits 10 checks per 60 seconds per
  privacy-hashed client address. Cloudflare rate limiting is intentionally
  permissive and eventually consistent.

## Local setup

Requires Node.js 22 or newer.

```sh
cd backend/url-inspector
npm ci
Copy-Item .dev.vars.example .dev.vars
```

Replace the local placeholder values in `.dev.vars`. The backend `.gitignore`
explicitly excludes that file from Git.

Run:

```sh
npm test
npm run typecheck
npm run dev
```

Example request:

```sh
curl -X POST http://localhost:8787/api/url-check \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/"}'
```

## Cloudflare configuration and deployment

The production Worker must already contain encrypted secrets named:

- `GOOGLE_SAFE_BROWSING_API_KEY`
- `APP_HASH_SECRET`

If configuring a new Worker, set them interactively:

```sh
npx wrangler secret put GOOGLE_SAFE_BROWSING_API_KEY
npx wrangler secret put APP_HASH_SECRET
```

Review the Worker name, route strategy, and unique rate-limit `namespace_id` in
`wrangler.toml` before deployment. Then validate without deploying:

```sh
npm run deploy
```

To deploy intentionally:

```sh
npx wrangler deploy
```

No deployment or frontend integration is performed by Phase 1.

## Response states

- `known_threat_detected`
- `no_known_threat_detected`
- `unavailable`

The result is a reputation lookup, not a guarantee that a URL is safe.

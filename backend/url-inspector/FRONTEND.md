# Sentinel URL Inspector Frontend

The static, dependency-free interface is published at:

`https://sithbusiness.com/url-inspector.html`

## File structure

- `../../url-inspector.html` — semantic page structure, metadata, and page CSP
- `../../assets/css/url-inspector.css` — isolated responsive workstation styling
- `../../assets/js/url-inspector.js` — validation, structural analysis, Worker
  request handling, passive metadata rendering, and in-memory session history
- `tests/url-inspector-frontend.test.ts` — frontend logic, privacy, response, and
  request-lifecycle tests

The page reuses `assets/css/sentinel-map.css` for Sentinel typography, tokens,
header, footer, and accessibility conventions. It does not load map JavaScript.

## Worker endpoint configuration

The production origin is centralized in `assets/js/url-inspector.js` and
allowlisted by the page CSP in `url-inspector.html`:

`https://sentinel-url-inspector.great-gs.workers.dev`

The frontend calls only:

`POST <WORKER_BASE_URL>/api/url-check`

Do not add a wildcard CSP origin. Keep the Worker CORS allowlist restricted to
`https://sithbusiness.com` and `https://www.sithbusiness.com`.

## Passive providers and data handling

All provider calls originate in the Worker. The browser never contacts an
enrichment provider.

- Google Safe Browsing v5 receives the normalized URL for reputation checking.
- Cloudflare DNS-over-HTTPS receives the normalized hostname for A, AAAA, MX,
  NS, and CNAME queries. Each query has a 3.5-second timeout and 64 KiB limit.
- `rdap.org` receives the hostname for domain RDAP and the selected public IP
  for network RDAP. Each request has a 5-second timeout and 384 KiB limit.
- RIPEstat Prefix Overview receives one resolved public IP for ASN and network
  holder metadata. It has a 4-second timeout and 128 KiB limit.
- `crt.sh` receives the normalized hostname for an exact passive Certificate
  Transparency query. It has a 5-second timeout and 1 MiB limit. Returned names
  are sanitized, restricted to the queried domain, sorted, and limited to 20.

Provider requests use GET, reject redirects, enforce response-size limits, and
strictly validate returned JSON. Independent settled-result handling means a
timeout, oversized response, malformed response, or provider error marks only
the affected metadata section unavailable. Enrichment failure never changes
the independent Google Safe Browsing result. Missing or redacted registration
fields remain unavailable and are not treated as suspicious.

External providers can observe the hostname or IP sent to them. The Worker does
not log submitted URLs, hostnames, DNS records, or returned metadata, and the
public response contains no provider request URLs or raw upstream responses.

## Privacy and security behavior

- Submitted URLs are held only in the input and active request.
- URLs are not stored in localStorage, sessionStorage, cookies, page query
  strings, or session-history entries.
- Current-tab history contains only status, checked time, and a shortened
  privacy-safe HMAC.
- Submitted URLs and returned domains, IPs, and certificate names are inert
  text, never clickable links.
- Dynamic content uses `textContent`, `createElement`, and `replaceChildren`;
  no dynamic `innerHTML` is used.
- Superseded browser requests are aborted.
- The page loads no third-party scripts or analytics.

## Scope and limitations

The Worker never requests the submitted website. Redirect-chain inspection,
live TLS handshakes, headers, ports, content downloads, screenshots, browser
automation, and active probing are excluded because they would contact or
execute against the destination and change the privacy and safety model.

RDAP availability varies by registry, particularly for subdomains. Missing
registration data is not an age or ownership conclusion. Network registration
country describes infrastructure registration and is not necessarily the
website owner’s physical location. Certificate Transparency data can be
incomplete, duplicated, delayed, or historical and does not prove that a
certificate is currently deployed.

Structural indicators and passive metadata are context, not proof of malicious
or harmless behavior. Google Safe Browsing is a point-in-time reputation
signal. “No known threat detected” is not a guarantee that a URL is harmless.

## Local operation and validation

Serve the repository through a local HTTP server; opening the page as a
`file://` URL is not recommended.

From the repository root:

```sh
python -m http.server 8000
```

From `backend/url-inspector`:

```sh
npm ci
npm test
npm run typecheck
npm run deploy
npm audit --omit=dev
```

`npm run deploy` is a Wrangler dry run and does not deploy. Also run
`git diff --check` from the repository root.

The existing GitHub Pages workflow publishes root-level static files on a push
to `main`; this feature does not change that workflow. Before release, rerun all
checks, deploy and verify the Worker separately, confirm production CORS from
both allowed origins, and commit only through the repository’s reviewed
process.

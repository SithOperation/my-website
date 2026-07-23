# Sentinel URL Inspector Frontend

Phase 2 adds a static, dependency-free interface at:

`https://sithbusiness.com/url-inspector.html`

## File structure

- `../../url-inspector.html` — semantic page structure, metadata, and page CSP
- `../../assets/css/url-inspector.css` — isolated responsive workstation styling
- `../../assets/js/url-inspector.js` — validation, passive structural analysis,
  Worker request handling, safe DOM rendering, and in-memory session history
- `tests/url-inspector-frontend.test.ts` — frontend logic, privacy, response, and
  request-lifecycle tests

The page also reuses `assets/css/sentinel-map.css` for Sentinel typography,
tokens, header, footer, and accessibility conventions. It does not load the map
renderer or map JavaScript.

## Worker endpoint configuration

The endpoint is centralized in one exported constant near the top of:

`assets/js/url-inspector.js`

Current placeholder:

`https://sentinel-url-inspector.account-subdomain.workers.dev`

After Worker deployment:

1. Replace `WORKER_BASE_URL` with the exact deployed HTTPS origin.
2. Replace the same placeholder origin in `url-inspector.html` under
   `connect-src`.
3. Do not add a wildcard origin.
4. Confirm the Worker CORS allowlist still includes:
   - `https://sithbusiness.com`
   - `https://www.sithbusiness.com`

The frontend calls only:

`POST <WORKER_BASE_URL>/api/url-check`

## Local operation

Serve the repository through a local HTTP server; opening the HTML as a
`file://` URL is not recommended.

From the repository root:

```sh
python -m http.server 8000
```

Then open:

`http://localhost:8000/url-inspector.html`

The placeholder Worker origin will not produce live results. Local Worker
testing requires updating the constant and CSP to the local Worker origin for
the duration of local development, then restoring the production origin before
release.

## Tests and validation

From `backend/url-inspector`:

```sh
npm ci
npm test
npm run typecheck
npm run deploy
npm audit --omit=dev
```

`npm run deploy` is configured as a Wrangler dry run and does not deploy.

From the repository root:

```sh
git diff --check
```

## Privacy and security behavior

- Submitted URLs are held only in the input and active request.
- URLs are not stored in localStorage, sessionStorage, cookies, page query
  strings, or session-history entries.
- Current-tab history contains only status, checked time, and a shortened
  privacy-safe HMAC.
- The submitted URL is displayed only as inert text, never as a clickable link.
- Dynamic content is rendered with `textContent`, `createElement`, and
  `replaceChildren`; no dynamic `innerHTML` is used.
- Superseded requests are aborted.
- The browser fetches only the configured Sentinel Worker endpoint.
- The inspector page intentionally loads no third-party scripts or analytics.

## Analysis scope and limitations

The browser performs only native-URL parsing and deterministic string
inspection. It does not fetch the destination and does not perform DNS, WHOIS,
TLS/certificate, redirect-chain, ASN, geolocation, hosting, or domain-age
analysis.

Structural indicators are contextual observations, not proof of malware,
phishing, or harmlessness. Google Safe Browsing results are point-in-time
reputation signals. “No known threat detected” is not a guarantee that a URL is
harmless.

## Frontend deployment

The repository’s existing GitHub Pages workflow publishes root-level static
files on a push to `main`. Phase 2 does not change that workflow. Before any
intentional frontend release:

1. Deploy and verify the Worker separately.
2. Replace both endpoint placeholders.
3. Rerun frontend and backend tests.
4. Confirm production CORS from both allowed site origins.
5. Commit and push only through the repository’s normal reviewed process.

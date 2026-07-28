# Sentinel publication operations

## Purpose

The Sentinel publication pipeline moves one validated physical-event release
from `SithOperation/sentinel-grid-intelligence` into the production global map
at `https://sithbusiness.com/sentinel.html`.

The publication path is:

```text
Sentinel collection and validation
  -> Sentinel data commit
  -> repository dispatch or scheduled website fallback
  -> isolated source staging
  -> atomic website data update
  -> exact-commit Pages deployment
  -> JSON and browser production verification
```

## Publication guarantees

- Sentinel artifacts listed by `manifest.json` are accepted or rejected as one
  publication.
- Invalid or incomplete source data does not replace last-known-good website
  files.
- A failed private disaster-monitor checkout does not block Sentinel.
- A candidate older than the website publication is rejected.
- The website commit SHA created by synchronization is passed explicitly to
  Pages. The initiating workflow SHA is not used as a substitute.
- A no-change synchronization still redeploys when production serves a
  different publication ID.
- Production is considered verified only after its JSON documents match and
  the browser map renders at least one feature.

## Retention

Sentinel publishes a rolling 72-hour event dataset. The website synchronizes
that complete publication. The interactive map displays the most recent
48 hours by default. Frontend filtering does not delete older synchronized
events.

## Required credentials

### Website `REPO_ACCESS_TOKEN`

Used only to read the private
`SithOperation/earthquake-volcano-discord-monitor` repository.

Required access:

- Repository selection limited to the disaster-monitor repository.
- Repository contents: read-only.
- No administration, secrets, workflow, or write permission.

If this token is missing or lacks access, the disaster job fails visibly.
Sentinel continues and last-known-good disaster files remain unchanged.

### Sentinel `WEBSITE_DISPATCH_TOKEN`

Used only to send `sentinel-publication-updated` repository-dispatch events to
`SithOperation/my-website`.

Required access:

- Repository selection limited to `SithOperation/my-website`.
- Permission sufficient to create repository dispatches.
- No contents write permission unless the selected token model requires it.

If this token is absent, Sentinel emits a warning and the website's scheduled
fallback remains active.

Never print either token, enable shell tracing around it, or place it in source
control. Record the owner and expiration in the private credential inventory
and rotate before expiration.

## Manual recovery

1. Open **Sync Monitor States** in the website repository.
2. Run `workflow_dispatch`.
3. Confirm `sync-sentinel` succeeds.
4. A disaster failure may remain visible; it must not skip
   `prepare-publication` or `commit-data`.
5. Confirm the summary lists the expected publication ID, website commit, and
   map-event count.
6. Confirm `verify-production` succeeds.
7. Open the production map with a cache-busting query string and confirm its
   displayed publication status.

## Diagnosing failures

| Stage | Meaning | Response |
|---|---|---|
| `sync-sentinel` | Sentinel checkout, contract, or checksum failure | Preserve production; inspect the Sentinel manifest and source workflow |
| `sync-disaster` | Private access or disaster contract failure | Repair least-privilege access; Sentinel may continue |
| `prepare-publication` | Downloaded artifact failed revalidation | Do not commit or deploy |
| `commit-data` | Stale candidate, transaction, rebase, or push failure | Compare `origin/main` and candidate generation timestamps |
| `deploy` | Exact-SHA validation, test, build, or Pages failure | Production remains on its previous deployment |
| `verify-production` | CDN, JSON contract, publication mismatch, or marker-render failure | Inspect production responses and the captured browser error |

## Rollback

1. Identify the last verified website deployment commit from the workflow
   summary or Pages deployment history.
2. Revert the publication/workflow change using a normal Git revert commit.
   Do not reset shared branches.
3. Run **Deploy Website** manually for the resulting commit.
4. Verify the production manifest, map data, health document, and browser map.
5. Keep the failed Sentinel database and source artifacts for diagnosis; do
   not delete retained data.

Before workflow changes, record the current Sentinel commit, website commit,
production publication ID, and Pages deployment ID. A branch or tag does not
capture uncommitted files, so dirty worktrees require a separate preservation
decision.

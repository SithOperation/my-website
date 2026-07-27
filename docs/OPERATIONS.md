# Website operations runbook

## X pipeline incidents

- **Failed collection:** inspect Sentinel's X source health and provider status;
  do not publish an invented empty feed.
- **Failed checkout:** rerun the normal monitor sync after confirming the public
  Sentinel repository and its manifest are available.
- **Stale/missing manifest:** preserve the last website generation and rerun
  Sentinel's normal collection workflow.
- **Malformed JSON/schema mismatch:** preserve the current website generation,
  correct Sentinel, and rerun collection.
- **Empty valid feed:** accept it; regeneration intentionally removes all X
  markers.
- **X token expiration:** replace `X_API_BEARER_TOKEN` in Sentinel, manually
  verify collection, then revoke the old token.

## Deployment incidents

- **Artifact rejection:** run staging and `production_gate.py` locally; remove
  forbidden paths or correct invalid generated data rather than weakening the
  gate.
- **Failed Pages deployment after validation:** rerun the deployment job. If
  content is defective, revert the responsible website commit and push the
  revert; do not rewrite history.
- **Stale browser generation:** confirm event and GeoJSON generation IDs match,
  then reload. The client retries stale caches with `no-store`.
- **Rollback:** use `git revert <commit>` in the affected repository, run all
  checks, push the revert, and manually run the downstream workflow. Never
  force-push production history.

## Workflow matrix

| Workflow | Trigger | Secret | Writes |
|---|---|---|---|
| Sync Monitor States | UTC candidates/manual | `REPO_ACCESS_TOKEN` | monitor JSON |
| Sync EWS | ten-minute fallback/dispatch/manual | `REPO_ACCESS_TOKEN` | EWS JSON |
| Sync AI Digest | UTC candidates/manual | `REPO_ACCESS_TOKEN` | digest JSON |
| Deploy Website | main push/manual | none | GitHub Pages artifact |
| Secret Scan | push/PR/manual | automatic `GITHUB_TOKEN` | none |


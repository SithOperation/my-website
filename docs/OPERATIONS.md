# Website operations runbook

## X pipeline incidents

- **Failed collection:** inspect the producer account results and provider
  status; do not dispatch or publish an invented empty feed.
- **Failed checkout:** verify the shared source token, expiry, SSO
  authorization, and Contents: read scope; start a new workflow run.
- **Stale/missing manifest:** do not fall back to producer `main`; rerun the
  producer slot or manually supply the exact known-good generation metadata.
- **Malformed JSON/schema mismatch:** preserve the current website generation,
  correct the producer, and retry the same slot.
- **Empty valid feed:** accept it; regeneration intentionally removes all X
  markers.
- **Dispatch failure after push:** rerun the completed producer slot. It
  re-dispatches the immutable generation and the website replay guard is safe.
- **Duplicate slot:** leave it skipped. Use `force` only for an intentional
  replacement and record the reason.
- **Delayed schedule:** starts within 07:45–09:00 or 16:45–18:00 Detroit remain
  eligible; outside-window runs publish nothing.
- **Token expiration:** replace the encrypted secret, manually verify, then
  revoke the old token.

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
| Sync X Early Reports | repository/manual dispatch | `REPO_ACCESS_TOKEN` | X feed, events, GeoJSON, sync state |
| Sync Monitor States | UTC candidates/manual | `REPO_ACCESS_TOKEN` | monitor JSON |
| Sync EWS | ten-minute fallback/dispatch/manual | `REPO_ACCESS_TOKEN` | EWS JSON |
| Sync AI Digest | UTC candidates/manual | `REPO_ACCESS_TOKEN` | digest JSON |
| Deploy Website | main push/manual | none | GitHub Pages artifact |
| Secret Scan | push/PR/manual | automatic `GITHUB_TOKEN` | none |


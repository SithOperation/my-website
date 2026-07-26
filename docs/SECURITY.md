# Repository security boundaries

## Repository credentials

Use fine-grained, expiring personal access tokens or a GitHub App installation
limited to the named source repository. Each website secret is separate:

| Secret | Repository access | Required permission |
|---|---|---|
| `REPO_ACCESS_TOKEN` | `SithOperation/x-sources` | Contents: read |
| `DISASTER_REPO_TOKEN` | `SithOperation/earthquake-volcano-discord-monitor` | Contents: read |
| `SENTINEL_REPO_TOKEN` | `SithOperation/sentinel-grid-intelligence` | Contents: read |
| `EWS_REPO_TOKEN` | `SithOperation/EWS-discord-monitor` | Contents: read |
| `AI_DIGEST_REPO_TOKEN` | `SithOperation/ai-cyber-daily-digest` | Contents: read |

The producer-side `WEBSITE_DISPATCH_TOKEN` is stored only in `x-sources`,
limited to `SithOperation/my-website`, and requires Contents: read/write to
create repository dispatches. `X_API_BEARER_TOKEN` is stored only in
`x-sources`. Rotate expiring tokens before expiry, replace the repository
secret, run the affected workflow manually, then revoke the old credential.

Checkout failures are required failures. Tokens are passed through action
inputs or authorization headers and must never appear in command arguments,
logs, response dumps, or Pages artifacts.

## Archive and deployment boundaries

Governance archive source IDs and decoded member paths are allowlisted.
Absolute, drive-qualified, UNC, traversal, encoded traversal, mixed-slash, and
symlink paths are rejected. Every destination is resolved and proven to remain
beneath its source root before writing.

Pages deployment uses an allowlisted staging operation and rejects browser
profiles, development files, secrets, caches, and temporary files.

## Automated scanning

Gitleaks runs for pushes and pull requests using `.gitleaks.toml`. Repository
administrators should also enable GitHub secret scanning and push protection.
Action major tags are compatibility-reviewed; production policy should replace
them with Dependabot-maintained immutable commit SHAs to reduce tag-movement
risk.

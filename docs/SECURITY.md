# Repository security boundaries

## Repository credentials

Use a fine-grained, expiring personal access token or GitHub App installation
limited to the five named private source repositories. The website uses one
shared source credential:

| Secret | Repository access | Required permission |
|---|---|---|
| `REPO_ACCESS_TOKEN` | X sources, disaster monitor, Sentinel Grid, EWS, and AI digest repositories | Contents: read |

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

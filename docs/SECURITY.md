# Repository security boundaries

## Repository credentials

Use a fine-grained, expiring personal access token or GitHub App installation
limited to the remaining named private source repositories. The website uses one
shared source credential:

| Secret | Repository access | Required permission |
|---|---|---|
| `REPO_ACCESS_TOKEN` | Private EWS and AI digest repositories | Contents: read |

Sentinel and X outputs are read from the public Sentinel repository without a
cross-repository token. `X_API_BEARER_TOKEN` is stored only in Sentinel Grid.
No website workflow requires `WEBSITE_DISPATCH_TOKEN` or an X-source token.

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

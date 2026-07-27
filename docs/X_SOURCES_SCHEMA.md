# X Sources Data Contract

Schema version `1.0` is the shared producer/consumer contract between the
Sentinel Grid backend and the Sentinel Grid website. Its normative JSON
Schema is `schema/x_sources.schema.json`; runtime rules that JSON Schema cannot
express are enforced by `models/x_report_contract.py`.

The document contains exactly `schema_version` and `reports`. An empty feed is:

```json
{"schema_version": "1.0", "reports": []}
```

## Report fields

Every report requires:

| Field | Rule |
| --- | --- |
| `schema_version` | Exactly `"1.0"` |
| `status_id` | Non-empty decimal X status identifier |
| `account` | X handle without `@`, 1–15 letters, digits, or underscores |
| `source_url` | Canonical `https://x.com/<account>/status/<id>` URL |
| `published_at` | Timezone-aware ISO 8601 publication timestamp |
| `collected_at` | Timezone-aware ISO 8601 collection timestamp |
| `summary` | Non-empty report text or summary |
| `event_type` | Allowed event type declared by the validator |
| `source_class` | Allowed X-source classification declared by the validator |
| `verification_status` | Allowed verification state declared by the validator |
| `confidence` | Finite JSON number from 0 through 1 |
| `latitude` | Finite JSON number from -90 through 90 |
| `longitude` | Finite JSON number from -180 through 180 |
| `location_name` | Non-empty human-readable location |
| `location_precision` | Allowed precision declared by the validator |

`quoted_url` and `reposted_url` are optional. When present, each value must be
either `null` or a canonical X status URL.

Unknown fields are rejected. Boolean and string coordinates are not numbers.
Naive timestamps, `NaN`, and infinity are rejected. Reports more than 10
minutes in the future or older than the configured 48-hour retention window
are rejected. Status IDs and canonical source URLs must be unique in a feed.

## Migration from the unversioned format

Version `1.0` replaces the previous implicit names:

| Legacy field | Version 1.0 field |
| --- | --- |
| `url` | `source_url` |
| `text` | `summary` |
| `quoted_source` | `quoted_url` |
| `reposted_from` | `reposted_url` |

The new required fields are `schema_version`, `status_id`, `collected_at`,
`verification_status`, and `confidence`. Producers must emit version `1.0`
atomically; consumers do not silently coerce or accept mixed legacy/versioned
documents. Empty feeds also carry the top-level schema version.

Breaking changes require a new schema version and coordinated producer and
consumer deployment. The matching valid and invalid fixtures under
`tests/fixtures/` are contract compatibility gates in both repositories.

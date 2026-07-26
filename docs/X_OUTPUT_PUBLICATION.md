# Transactional X output publication

Before Phase 5, `main.py` wrote `x_report_events.json` directly and then wrote
`x_report_pinpoints.geojson` directly. Neither document was validated or
staged. An exception during the second write left the first file from the new
run beside the GeoJSON from the previous run. No temporary files, durability
flush, backup, installed-pair validation, or rollback existed.

The website now uses a coordinated backup-and-replace transaction while
preserving both canonical public paths. It:

1. constructs events and report-level GeoJSON in memory;
2. assigns shared schema version, generation ID, and generated timestamp;
3. validates both complete documents and their one-report/one-feature count;
4. serializes strict deterministic UTF-8 JSON with `allow_nan=False`;
5. durably stages both files beside their destinations using flush and fsync;
6. durably backs up the exact previous bytes;
7. replaces both canonical files;
8. reads and validates the installed pair; and
9. removes backups only after complete success.

If either replacement or installed-pair validation fails, both prior byte
snapshots are restored. A handled publication failure therefore finishes with
the previous complete generation visible. If rollback itself fails, the CLI
returns the distinct critical exit code `2` and retains recovery backups where
possible. Ordinary generation, validation, staging, and publication failures
return `1`; success returns `0`.

The canonical files share:

```text
schema_version
generation_id
generated_at
```

Generation IDs use `YYYYMMDDTHHMMSSZ-<8 hex characters>`. The event document is
a top-level object containing `events`; the GeoJSON remains a valid
`FeatureCollection` with generation metadata as top-level foreign members.

Staging and backup names begin with `.x_report_` and are ignored by Git.
Pages artifact verification rejects temporary and backup suffixes. Normal
success and successfully handled failures leave no transaction files behind.

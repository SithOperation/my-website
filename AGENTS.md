# Joseph Technologies Library — Codex Instructions

## Purpose

This repository contains the Joseph Technologies website and original cybersecurity educational resources, including workbooks, PDF guides, SVG diagrams, JSON metadata, documentation, and publishing/validation scripts.

## Core rules

1. Preserve existing files unless explicitly instructed otherwise.
2. Never overwrite or delete received source archives without approval.
3. Do not rename public resource IDs or filenames without a documented migration.
4. Treat the workbook, PDF, SVG, metadata, README, and changelog for one ID as a resource package.
5. Preserve batch and part provenance in canonical metadata.
6. Use lowercase kebab-case for new public filenames and resource IDs.
7. Keep sample data clearly labeled as fictional.
8. Do not reproduce copyrighted standards, certification exams, proprietary instruments, or licensed framework text.
9. Do not present companion resources as official standards-body publications, certifications, legal advice, or guarantees.
10. Do not claim validation unless the relevant command completed successfully.

## Canonical layers

- `resource-library/resources/` — canonical resource metadata and documentation
- `assets/resources/` — approved public workbooks, PDFs, and diagrams
- `data/resource-library/resources.json` — generated website catalog
- `resources/` — public library interface
- `reports/` — inventory, migration, and validation evidence
- Received ZIP archives remain immutable provenance until explicitly archived in-repository.

## Required checks

Before completing library changes:

1. Validate JSON syntax and required fields.
2. Check duplicate IDs and public paths.
3. Confirm every referenced file exists.
4. Validate XLSX, PDF, and SVG containers.
5. Check website links and catalog rendering.
6. Run the available validation scripts.
7. Report changed files, commands, limitations, and unvalidated areas.

## Safety

- Do not expose credentials, personal information, private evidence, resumes, or identity documents in the public library.
- Do not silently change licensing or disclaimer language.
- Do not run destructive commands without explicit authorization.
- Prefer focused, reproducible scripts over manual bulk edits.

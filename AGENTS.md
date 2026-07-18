# Joseph Technologies Library — Codex Instructions

## Purpose

This repository contains the Joseph Technologies website and an authoritative cybersecurity governance source index. Official publisher links and immutable source records are separated from original companion material.

## Core rules

1. Preserve existing files unless explicitly instructed otherwise.
2. Never overwrite or delete received source archives without approval.
3. Do not rename public resource IDs or filenames without a documented migration.
4. Treat every folder under `governance-library/sources/` as one source package.
5. Preserve the official URL, publisher, edition, authority type, access classification, and research date.
6. Use lowercase kebab-case for new public filenames and resource IDs.
7. Keep sample data clearly labeled as fictional.
8. Do not reproduce copyrighted standards, certification exams, proprietary instruments, or licensed framework text.
9. Do not present companion resources as official standards-body publications, certifications, legal advice, or guarantees.
10. Do not claim validation unless the relevant command completed successfully.

## Canonical layers

- `governance-library/sources/` — authoritative source records and companion research notes
- `data/governance-library/sources.json` — generated website catalog
- `resources/` — public source-library interface
- `scripts/build-governance-library.py` — deterministic archive importer/catalog builder
- Licensed standards are link-only; government PDFs are linked to their official publisher locations.

## Required checks

Before completing library changes:

1. Validate JSON syntax and required fields.
2. Check duplicate IDs and public paths.
3. Confirm every referenced file exists.
4. Check that licensed standards have no redistributed binary.
5. Check source revision/withdrawal status and website rendering.
6. Run the available validation scripts.
7. Report changed files, commands, limitations, and unvalidated areas.

## Safety

- Do not expose credentials, personal information, private evidence, resumes, or identity documents in the public library.
- Do not silently change licensing or disclaimer language.
- Do not run destructive commands without explicit authorization.
- Create original content only as a clearly labeled companion; never alter an official record or publication.
- Prefer focused, reproducible scripts over manual bulk edits.

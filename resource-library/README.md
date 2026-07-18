# Cybersecurity Resource Library

This directory holds canonical resource records, generator source, schemas, migration tooling, and validation tools. The public interface is `resources/index.html`; approved artifacts are published under `assets/resources/`.

The current catalog contains 94 unique resources: the original validated CIA prototype plus 93 normalized archive packages.

## Regenerate the CIA prototype

From the repository root in PowerShell:

```powershell
$env:UV_CACHE_DIR="$PWD\.uv-cache"
uv run --python 3.12 --with reportlab python resource-library/scripts/generate.py
uv run --python 3.12 --with pypdf --with pymupdf --with jsonschema python resource-library/scripts/validate.py
```

The CIA validator writes rendered page previews and `VALIDATION.md` under `output/resource-library/`. That command validates the original prototype specifically; `validate_library.py` validates the expanded collection.

## Inventory, migration, and full-library validation

```powershell
$env:UV_CACHE_DIR="$PWD\.uv-cache"

uv run --python 3.12 python resource-library/scripts/inventory_archives.py `
  "C:\Users\newho\Downloads" --reports reports

uv run --python 3.12 python resource-library/scripts/migrate_archives.py `
  "C:\Users\newho\Downloads" --root .

uv run --python 3.12 --with pypdf --with pymupdf `
  python resource-library/scripts/validate_library.py --root .
```

The migration is deterministic. It preserves archive provenance in canonical metadata, retains the existing CIA prototype, and selects later batch/part versions when duplicate IDs occur.

# Cybersecurity Resource Library

This directory holds generator source, schema, and validation tools. The public interface is `resources/index.html`; generated artifacts are published under `assets/resources/`.

## Regenerate the CIA prototype

From the repository root in PowerShell:

```powershell
$env:UV_CACHE_DIR="$PWD\.uv-cache"
uv run --python 3.12 --with reportlab python resource-library/scripts/generate.py
uv run --python 3.12 --with pypdf --with pymupdf --with jsonschema python resource-library/scripts/validate.py
```

The validator writes rendered page previews and `VALIDATION.md` under `output/resource-library/`. Only the CIA Triad resource is published at the prototype checkpoint.

# Proposed Migration Plan

## Decision

Keep the existing `my-website` repository as the deployable GitHub Pages site. Preserve received archives as intake provenance, then normalize approved resources into resource-level canonical packages. Do not create a second, duplicated `website/` application tree.

## Canonical layers

1. **Intake:** immutable batch/part contents and archive checksums.
2. **Canonical source:** one directory per resource containing metadata, workbook, guide, diagrams, README, changelog, and optional source content.
3. **Generated catalog:** website-facing JSON derived from canonical metadata.
4. **Published assets:** approved `.xlsx`, `.pdf`, `.svg`, and optional `.png` files under `assets/resources/`.
5. **Archive:** deprecated and replaced versions retained with migration records.

## Safe execution sequence

1. Approve this inventory and canonical structure.
2. Copy—not move—the ZIP archives into `intake/archives/` and record SHA-256 checksums.
3. Extract each archive into an isolated staging directory with path-traversal and collision checks.
4. Reconcile master/part duplication and establish authoritative versions.
5. Validate JSON schemas, IDs, file references, XLSX packages, PDFs, SVG XML, and licensing/originality language.
6. Create resource-level packages without changing public IDs.
7. Generate catalogs and search data from canonical metadata.
8. Publish only resources that pass validation; mark incomplete packages as draft.
9. Extend the existing `/resources/` interface around the verified catalog.
10. Run link, download, responsive, accessibility, and document-render tests before deployment.

## Proposed canonical resource package

```text
resource-library/resources/<category>/<resource-id>/
├── README.md
├── CHANGELOG.md
├── metadata.json
├── source/
├── workbook/
├── guide/
└── diagrams/
```

## Approval boundary

This report does not authorize deleting, renaming, or overwriting received resources. Migration should begin only after the inventory findings and treatment of duplicates/incomplete packages are approved.

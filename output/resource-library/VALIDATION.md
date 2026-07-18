# CIA Triad validation report

Result: PASS

## Automated checks

- cia-triad-asset-assessment.pdf: 3 pages
- cia-triad-asset-assessment.pdf: 0 interactive fields
- cia-triad-asset-assessment-fillable.pdf: 3 pages
- cia-triad-asset-assessment-fillable.pdf: 34 interactive fields
- JSON Schema validation completed.
- Every PDF page was checked for US Letter dimensions.
- PDF form dictionaries and required descriptive field names were inspected.
- Text blocks were checked against page bounds.
- Every page was rasterized with PyMuPDF for visual inspection.
- Catalog publication state was checked (CIA Triad only).

## Tooling

Structural checks used pypdf and visual rendering used PyMuPDF; qpdf/Poppler were not available on this machine.

## Errors

- None.

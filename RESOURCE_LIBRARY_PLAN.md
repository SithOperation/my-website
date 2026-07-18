# Cybersecurity Resource Library Implementation Plan

## Repository audit

### 1. Framework and build system

The website is a dependency-free static site built with HTML, CSS, and browser JavaScript. There is no package manifest, application framework, bundler, or compilation step. The repository is structured for GitHub Pages (`CNAME` and `.nojekyll`) and can be previewed with any local HTTP server.

### 2. Existing page structure

- `index.html` is the portfolio homepage, with About, Cyber News, Sentinel dashboard, Modules, Skills, Resume, and Contact sections.
- `sentinel.html` is a separate MapLibre-based intelligence dashboard.
- `assets/js/site.js` drives homepage interactions and loads static JSON from `data/`.
- `assets/js/sentinel-*.js` and `assets/css/sentinel-map.css` are isolated to the Sentinel experience.
- `.github/workflows/sync-states.yml` updates the site's static intelligence data; it does not provide an application backend.

### 3. Current visual design system

The active design is a dark, industrial cyber-intelligence theme. The current token layer in `style.css` uses near-black backgrounds, charcoal panels, warm off-white text, muted gray, deep red accents, steel borders, and a warm tan secondary accent. Interfaces combine `Inter`/`Segoe UI`/Arial body text with monospace labels, uppercase tracking, compact status treatments, hard-edged panels, and responsive layouts. The library should reuse these tokens and conventions rather than the ZIP's unrelated teal/magenta theme.

### 4. Safest integration point

Add a dedicated static page at `resources/index.html` and link it from the homepage navigation or Modules area. This keeps the already-large homepage and Sentinel scripts stable, gives resource detail views enough room, and allows relative asset paths to remain predictable. Library-only CSS and JavaScript should live under `assets/css/` and `assets/js/`. Shared source metadata should live under `data/resource-library/`; downloadable artifacts should live under `assets/resources/`.

### 5. Static versus server-side behavior

The site is fully static. Search, category filtering, card rendering, and individual resource views must run in the browser from JSON. PDFs and SVGs are generated before deployment and committed as ordinary assets. No server-side form processing or storage is planned.

### 6. Existing downloadable-asset convention

Current PDFs and images are stored under `assets/projects/` and linked with ordinary relative URLs, usually opening PDFs in a new tab. The resource library will follow the same direct-download approach, while using a dedicated `assets/resources/{pdf,diagrams}/` namespace to avoid mixing reusable public worksheets with portfolio project evidence.

## ZIP assessment

The supplied archive provides a useful twelve-resource inventory, category folders, rough metadata, guides, worksheet outlines, diagrams, and sample PDFs. It is starter material rather than a complete generator system:

- Metadata lacks purpose, instructions, framework alignment, version/review dates, disclaimers, official sources, tags, search metadata, printable/fillable distinctions, and accessibility details.
- PDF and diagram generator scripts are placeholders and cannot reproduce the supplied files.
- The validator checks only whether files exist; it does not validate PDF structure, fields, dimensions, or rendering.
- The bundled interface uses HTML-string injection and does not offer individual resource pages.
- All twelve outputs are pre-generated, conflicting with the requested CIA-only checkpoint.

Only the inventory and useful source concepts will be adapted. The first release checkpoint will publish one complete resource and list the remaining eleven as planned metadata entries without downloadable artifacts.

## Proposed source-driven architecture

```text
resources/index.html                         Library interface and detail route
assets/css/resource-library.css             Library-specific presentation/print rules
assets/js/resource-library.js               Safe JSON rendering, search, filters, details
data/resource-library/resources.json        Canonical catalog and search metadata
resource-library/schema/resource.schema.json Metadata contract
resource-library/templates/                 Generator templates and shared branding
resource-library/resources/<slug>.json      Worksheet/page/field source definitions
resource-library/scripts/generate.py        Deterministic SVG and PDF generator
resource-library/scripts/validate.py        Schema, PDF, field, and asset checks
assets/resources/pdf/                        Published PDF outputs
assets/resources/diagrams/                   Published original SVG outputs
output/resource-library/                     Rendered validation previews/reports
```

The canonical catalog describes all twelve planned resources. A resource definition contains content and form fields for publishable items. The generator reads those definitions and produces artifacts; the browser reads the catalog to create cards and resource details. No resource page is manually duplicated.

## Metadata contract

Each catalog entry will support:

- identity: slug, title, category, status, resource type
- editorial content: short description, purpose, when to use, instructions
- provenance: framework alignment and official-source links
- lifecycle: document version and last-reviewed date
- rights: original-material statement, legal/copyright, non-endorsement, and non-certification disclaimer
- deliverables: printable PDF, optional fillable PDF, and SVG/PNG diagram paths
- discovery: tags, keywords, and normalized search text
- accessibility: descriptive diagram alt text and field labels

Resource definitions add page sections, tables, writing areas, checkbox/radio groups, dates, single-line fields, multiline fields, descriptive field names, and explicit reading/tab order.

## Prototype: CIA Triad Asset Assessment

The first completed sample will include:

1. A searchable/filterable library card and metadata-driven detail view.
2. Original instructional content for asset context, confidentiality, integrity, availability, prioritization, and control planning.
3. An original SVG diagram using the site's charcoal, warm-white, red, tan, and steel palette.
4. A US Letter printable worksheet with print-safe margins, branded header/footer, page numbers, version/review date, instructions, empty writing areas, checkboxes/tables, and disclaimers.
5. A fillable PDF variant with descriptive text/date/multiline/checkbox/radio fields and an intentional tab order.
6. Official public-source links (not redistributed standards text), favoring authoritative framework publications.

The resource will be clearly labeled as original companion material. It will not quote or reproduce ISO standards, PCI SSC assessment documents, proprietary certification materials, or restricted templates.

## Validation and acceptance checks

- Validate JSON syntax and required metadata/field properties.
- Confirm generated PDFs use US Letter dimensions and expected page counts.
- Inspect PDF form annotations for unique descriptive names, supported field types, bounds inside pages, and deterministic tab order.
- Run an available structural checker (`qpdf --check`, `pdfinfo`, or equivalent). If unavailable, use a Python PDF parser and record that limitation.
- Render every PDF page to PNG with an available renderer such as Poppler or MuPDF.
- Inspect rendered pages for clipping, overlap, broken controls, unreadable text, margins, headers, footers, and page numbering.
- Run a local HTTP preview and verify loading, search, filters, detail routing, responsive behavior, keyboard focus, and missing-asset handling.
- Ensure only CIA Triad artifacts are published at this checkpoint.

## Execution order and stop point

1. Establish schema, catalog, templates, and output conventions.
2. Add the dedicated library interface and minimally link it into the existing site.
3. Implement deterministic generation and validation scripts.
4. Complete the CIA Triad definition, SVG, printable PDF, and fillable PDF.
5. Validate and render both PDF variants, then visually inspect the images.
6. Report all changed files and exact regeneration commands.
7. Stop. Do not generate the remaining eleven resource packages until approval.


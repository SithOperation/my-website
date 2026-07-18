# Cybersecurity Resource Library — Project Overview and Roadmap

## Project summary

The Cybersecurity Resource Library is a professional, source-driven collection of original cybersecurity worksheets, assessment forms, defensive architecture diagrams, and links to authoritative public framework publications.

The library is integrated into the Joseph Technologies website and follows its dark, industrial cyber-intelligence visual language. It is designed as a static, GitHub Pages-compatible system that does not require a backend, database, paid service, JavaScript framework, or application build pipeline.

The first implementation checkpoint established the reusable system and the validated CIA Triad Asset Assessment. The subsequent batch migration expanded the public catalog to 94 unique resources: the CIA prototype plus 93 verified archive packages containing Excel workbooks, PDF guides, and SVG diagrams.

> Current release status (2026-07-18): 94 published catalog resources, 93 workbooks, 95 PDFs, and 94 SVG diagrams. See `reports/full-library-validation.md` and `reports/canonical-migration-record.md` for validation and provenance details.

## Current website framework

### Technology stack

- HTML5
- CSS3
- Vanilla JavaScript
- Static JSON data
- Python-based document generation scripts
- GitHub Pages-compatible deployment
- GitHub Actions for existing data synchronization
- No server-side application
- No database
- No frontend framework
- No bundler or compilation step
- No paid external service

### Existing website structure

- `index.html` — main portfolio and dashboard
- `sentinel.html` — dedicated Sentinel intelligence map
- `style.css` — global visual design system
- `assets/js/site.js` — homepage functionality
- `assets/js/sentinel-*.js` — Sentinel data and map behavior
- `assets/css/sentinel-map.css` — Sentinel-specific styling
- `data/` — static JSON intelligence and website data
- `assets/projects/` — existing downloadable PDFs and project evidence
- `.github/workflows/` — automated data synchronization workflows

The resource library is isolated from the Sentinel system and existing homepage logic to reduce the risk of regressions.

## Resource library architecture

### Public interface

The library has a dedicated page at `resources/index.html` and is linked from the main website navigation.

A dedicated page was selected because it:

- Keeps the existing homepage stable
- Prevents the homepage from becoming overly large
- Provides room for filtering and resource details
- Supports direct links to individual resources
- Allows the library to grow independently
- Keeps resource-specific JavaScript and CSS isolated
- Preserves straightforward GitHub Pages deployment

### Source-driven approach

The library does not manually hard-code a separate HTML page for every resource. Structured JSON metadata generates:

- Resource cards
- Search results
- Category filters
- Resource descriptions
- Instructions
- Framework alignment information
- Official publication links
- Version information
- Legal notices
- Download buttons
- Individual resource detail views

The primary public catalog is `data/resource-library/resources.json`. The completed CIA worksheet source is `resource-library/resources/cia-triad.json`.

This architecture allows future resources to use the same interface, templates, validation rules, and generation process.

## Current directory structure

```text
my-website/
├── index.html
├── style.css
├── RESOURCE_LIBRARY_PLAN.md
├── CYBERSECURITY_RESOURCE_LIBRARY_OVERVIEW.md
├── resources/
│   └── index.html
├── assets/
│   ├── css/resource-library.css
│   ├── js/resource-library.js
│   └── resources/
│       ├── pdf/
│       │   ├── cia-triad-asset-assessment.pdf
│       │   └── cia-triad-asset-assessment-fillable.pdf
│       └── diagrams/cia-triad.svg
├── data/resource-library/resources.json
├── resource-library/
│   ├── README.md
│   ├── schema/resource.schema.json
│   ├── resources/cia-triad.json
│   ├── templates/README.md
│   └── scripts/
│       ├── generate.py
│       └── validate.py
└── output/resource-library/
    ├── VALIDATION.md
    ├── cia-triad-asset-assessment/page-1.png ... page-3.png
    └── cia-triad-asset-assessment-fillable/page-1.png ... page-3.png
```

## Current library capabilities

### Search and filtering

The library provides client-side search across resource titles, descriptions, categories, framework names, tags, keywords, and security concepts. It supports these categories:

- Security Models
- Risk Management
- Incident Response
- Privacy
- Compliance
- Architecture
- Governance

Filter buttons are generated from catalog metadata rather than manually maintained HTML.

### Resource cards and details

Each card can show category, publication status, title, description, version, tags, and a detail action. Planned resources do not expose broken download links.

The reusable detail interface supports title, category, status, description, purpose, when to use it, instructions, framework alignment, version, review date, disclaimers, official sources, printable PDF, fillable PDF, and SVG diagram.

Direct resource links use a query parameter:

```text
/resources/?resource=cia-triad
```

### Security and accessibility

Catalog data is rendered with safe DOM text assignment rather than raw HTML injection. Accessibility features include semantic sections, search labels, accessible filter state, keyboard controls, focus indicators, live result counts, status announcements, descriptive links, diagram descriptions, responsive layouts, reduced-motion support, high contrast, and a skip-to-content link.

## Visual design system

The library uses the Joseph Technologies design language:

- Near-black backgrounds
- Charcoal panels
- Warm off-white text
- Muted steel-gray supporting text
- Deep red primary accents
- Warm tan secondary accents
- Steel borders
- Monospace operational labels
- Uppercase section identifiers
- Industrial intelligence-oriented panels
- Responsive card grids
- Strong keyboard focus indicators

It inherits the existing CSS tokens `--site-bg`, `--site-panel`, `--site-panel-alt`, `--site-steel`, `--site-line`, `--site-text`, `--site-muted`, `--site-accent`, `--site-warm`, and `--content-width`.

## Completed prototype: CIA Triad Asset Assessment

The assessment helps document what an asset is, who owns it, the business process it supports, information it contains, CIA failure scenarios, impacts, safeguards, gaps, owners, dates, and review information.

### Page 1 — Asset profile

- Assessment date and assessor
- Asset name and owner
- Asset-type checkboxes
- Business process
- Asset description, users, dependencies, and data handled
- Initial impact overview
- Sensitive-information handling reminder

### Page 2 — Security objectives

Separate confidentiality, integrity, and availability areas each include:

- Low, Moderate, and High impact choices
- Business-impact scenario
- Existing safeguards
- Supporting evidence
- Priority control gaps

### Page 3 — Control action plan

- Highest-priority objective
- Risk and priority summary
- Two control-action records
- Action owners and target dates
- Review notes and accepted constraints
- Asset-owner acknowledgement
- Reviewer and review date
- Legal and copyright notice

## PDF outputs

### Printable PDF

`assets/resources/pdf/cia-triad-asset-assessment.pdf`

- US Letter size
- Three pages
- Print-safe margins
- Branded headers and footers
- Page numbers
- Version and review date
- Instructions, tables, writing areas, and printable checkboxes
- Accessible typography
- Original-material, non-endorsement, non-certification, and legal notices
- No interactive annotations

### Fillable PDF

`assets/resources/pdf/cia-triad-asset-assessment-fillable.pdf`

- US Letter size
- Three pages
- 34 interactive fields
- Single-line, multiline, checkbox, radio-button, and date fields
- Descriptive field names
- Intentional creation/tab order
- Fields contained inside designated boundaries
- Labels and borders remain visible

## Original CIA diagram

`assets/resources/diagrams/cia-triad.svg` is an original scalable diagram showing confidentiality, integrity, and availability connected to a protected asset. It uses the website palette, includes semantic SVG title and description elements, and has no copied imagery or external dependencies.

## Metadata model

Each resource supports:

- Slug, category, status, title, and description
- Purpose, use case, and instructions
- Framework alignment and official sources
- Version and last-reviewed date
- Legal disclaimer and copyright notice
- Tags, keywords, and diagram alternative text
- Printable PDF, fillable PDF, SVG, and optional PNG paths

Publication states support `published` and `planned`. The current normalized collection contains 94 published resources. CIA Triad remains the bespoke fillable-PDF prototype; imported packages generally provide an Excel workbook, PDF companion guide, and SVG diagram.

## Validation system

`resource-library/scripts/validate.py` checks:

- JSON Schema compliance
- Required source properties
- PDF existence and page counts
- US Letter dimensions
- Printable PDF annotation absence
- Fillable PDF fields and descriptive names
- Expected minimum field count
- Text boundaries
- Catalog publication state
- CIA-only prototype enforcement
- Successful rendering of every page

The toolchain uses ReportLab for generation, pypdf for PDF inspection, PyMuPDF for rendering, and JSON Schema for data validation. qpdf and Poppler were not directly available on the development machine.

Current result: **PASS**.

- Printable PDF: 3 pages and 0 interactive fields
- Fillable PDF: 3 pages and 34 interactive fields
- Letter dimensions confirmed
- Required fields confirmed
- Six pages rendered successfully
- All 94 canonical resource IDs marked published with resolved public assets
- No automated errors

Visual inspection checked clipping, margins, overlapping labels, field boundaries, control sizes, typography, headers, footers, and page numbers. An initial radio-button sizing defect was found, fixed, regenerated, and revalidated. No remaining clipping or overlap was found.

## Legal and copyright boundaries

The library must not reproduce ISO standards, ISO control language, PCI SSC assessment documents, proprietary certification materials, licensed audit programs, commercial compliance templates, restricted publications, or official forms that cannot be redistributed.

The library will create original companion materials, summarize concepts in original language, link to official sources, identify framework publishers, avoid claims of endorsement or certification, publish versions and dates, and encourage validation against current official guidance.

The CIA resource is explicitly identified as original Joseph Technologies companion material, not an official NIST form, not endorsed, not a certification instrument, and not legal, regulatory, audit, or compliance advice.

## Official-source strategy

Links should prioritize NIST, CISA, HHS, FTC, DOJ, National Archives, government publications, and official standards-body publication pages. The CIA prototype links to NIST CSF 2.0, NIST SP 800-53 Revision 5, and FIPS 199. Links and publication revisions should be reviewed periodically.

## Planned resource catalog

### 1. CIA Triad Asset Assessment — Published

Category: Security Models. Includes printable/fillable PDFs, original SVG, website detail view, and official sources.

### 2. AAA Access Review — Planned

Authentication, authorization, accounting, credential lifecycle, privileged access, roles, logging, findings, owners, and review dates. Potential alignment includes NIST SP 800-53, NIST Digital Identity Guidelines, and Zero Trust concepts.

### 3. Bell-LaPadula Access Matrix — Planned

Classifications, clearances, subjects, objects, read/write permissions, flows, exceptions, and review evidence, expressed in original language.

### 4. Biba Integrity Assessment — Planned

Integrity levels, trusted subjects and objects, read/write paths, provenance, validation, change controls, exceptions, and remediation.

### 5. Defense-in-Depth Planner — Planned

Governance, identity, endpoint, network, application, data, monitoring, response, recovery, physical security, dependencies, threat scenarios, safeguard inventory, failure points, ownership, and gaps.

### 6. NIST CSF 2.0 Profile Worksheet — Planned

Scope, business context, current and target profiles, priority outcomes, gaps, owners, dates, evidence, and governance across Govern, Identify, Protect, Detect, Respond, and Recover. It will link to the official NIST publication.

### 7. NIST RMF Planning Worksheet — Planned

Prepare, Categorize, Select, Implement, Assess, Authorize, and Monitor activities, roles, evidence, milestones, decisions, and continuous-monitoring planning. It will supplement—not reproduce—official guidance.

### 8. Cybersecurity Risk Register — Planned

Risk ID, scenario, asset, threat, vulnerability, likelihood, impact, inherent risk, controls, treatment, owner, target date, residual risk, acceptance, review date, and status.

### 9. Incident Intake Form — Planned

Reporter, timing, affected systems/accounts, indicators, facts, data exposure, severity, impact, containment, escalation, incident lead, evidence references, and notifications. It will not request secrets or credentials.

### 10. Digital Evidence Chain-of-Custody Form — Planned

Case/evidence IDs, description, source, collector, timing, method, device information, hashes, storage, transfers, recipients, purpose, receipt, and disposition. It will advise obtaining jurisdiction-specific legal guidance.

### 11. Privacy Impact Assessment — Planned

Purpose, personal-data inventory, data subjects, sources, flows, sharing, access, retention, disposal, individual rights, safeguards, risks, treatments, approvals, and reviews, potentially aligned with the NIST Privacy Framework.

### 12. Vendor Security Review — Planned

Vendor/service profile, data, access, geography, subprocessors, governance, IAM, encryption, vulnerabilities, logging, response, continuity, privacy, contracts, evidence, findings, approval, conditions, and reassessment.

## Future development plan

### Phase 1 — CIA prototype

Complete: repository audit, architecture plan, interface, search, filters, catalog, schema, generator, validator, printable/fillable CIA PDFs, original SVG, sources, rendered previews, and documentation.

### Phase 2 — Prototype review

- Review deployed desktop and mobile design
- Test keyboard navigation
- Test PDFs in multiple viewers
- Enter realistic data in every field
- Review printed US Letter output
- Confirm branding and disclaimers
- Decide whether to retain validation PNGs
- Consider diagram previews, copy links, sorting, published-only filters, version history, related resources, breadcrumbs, and documentation

### Phase 3 — Generator generalization

Make layouts fully declarative so arbitrary resource definitions can configure sections, page breaks, tables, field types, printable/fillable variants, diagrams, headers, footers, metadata, margins, names, bounds, filenames, and validation manifests.

Supported field types should include text, multiline, date, checkbox, radio, rating, acknowledgement, repeating table, instruction box, risk matrix, and action register.

### Phase 4 — Remaining resource production

Recommended order:

1. AAA Access Review
2. Defense-in-Depth Planner
3. Cybersecurity Risk Register
4. Incident Intake Form
5. Digital Evidence Chain-of-Custody Form
6. Privacy Impact Assessment
7. Vendor Security Review
8. NIST CSF 2.0 Profile Worksheet
9. NIST RMF Planning Worksheet
10. Bell-LaPadula Access Matrix
11. Biba Integrity Assessment

Each must be researched from official sources, written originally, reviewed for redistribution boundaries, defined in metadata, generated, structurally validated, rasterized, visually inspected, realistically tested, and approved before publication.

### Phase 5 — Stronger quality assurance

- Add qpdf, Poppler, and potentially veraPDF
- Detect duplicate fields and invalid bounds
- Verify tab order and document metadata
- Review tagging and font embedding
- Test multiple viewers
- Validate official URLs and HTML
- Add accessibility checks, JavaScript linting, screenshot comparison, and broken-link detection

### Phase 6 — GitHub Actions automation

A future workflow can validate metadata, generate outputs, validate PDFs, render previews, enforce publication rules, reject missing or duplicate resources, check links, and publish GitHub Pages artifacts. It should not overwrite approved documents without a version or review-date change.

### Phase 7 — Versioning and governance

Track document version, review/publication dates, change summary, framework version, source URLs, content owner, reviewers, scheduled review, status, and replacement resources. Potential statuses include Draft, Under Review, Published, Revision Pending, Deprecated, and Archived.

### Phase 8 — Expanded features

Potential additions include static SEO detail pages, related resources, recently updated indicators, changelogs, bundles, PNG exports, print preview, local favorites, offline caching, comparisons, framework/role browsing, maturity indicators, contribution guidance, feedback, and translation-ready metadata.

Features involving submitted data, accounts, cloud storage, or server processing would require a separate backend plus privacy and security review.

## Current limitations

- Only CIA Triad currently has a purpose-built fillable PDF
- Imported batch resources use their supplied Excel/PDF/SVG packages and normalized metadata
- The PDF generator remains specialized around the CIA layout
- No backend, database, accounts, or submitted-data storage exists
- Local JSON loading requires an HTTP server
- PDF/UA conformance is not claimed
- Cross-viewer form testing is not yet comprehensive
- Official links require periodic review
- Framework alignment is not compliance
- Worksheets do not replace professional legal, regulatory, audit, forensic, or compliance advice

## Regeneration instructions

From the repository root in PowerShell:

```powershell
$env:UV_CACHE_DIR="$PWD\.uv-cache"

uv run --python 3.12 --with reportlab `
  python resource-library/scripts/generate.py

uv run --python 3.12 --with pypdf --with pymupdf --with jsonschema `
  python resource-library/scripts/validate.py
```

Public outputs are written to `assets/resources/pdf/` and `assets/resources/diagrams/`. Validation output is written to `output/resource-library/`, including `VALIDATION.md`.

## Deployment and preview

After deployment:

```text
https://YOUR-DOMAIN/resources/
https://YOUR-DOMAIN/resources/?resource=cia-triad
```

For local preview:

```powershell
uv run --python 3.12 python -m http.server 8000
```

Then open `http://localhost:8000/resources/`.

## Completion status

Complete: repository inspection, architecture, dedicated interface, search, filters, source-driven cards/details, 26-archive inventory, 94-resource canonical catalog, package migration, workbook/PDF/SVG publication, schema normalization, CIA printable/fillable PDFs, document validation, homepage link, and regeneration documentation.

Intentionally deferred: fillable-PDF conversion for imported resources, exhaustive manual visual/editorial review of every imported document, backend/account functionality, submitted-data storage, and any claim of compliance, certification, or standards-body endorsement.

The next step is to review the deployed CIA prototype and approve the layout and generation approach before producing additional resources.

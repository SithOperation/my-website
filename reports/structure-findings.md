# Structure Findings

## Executive findings

- **Archive integrity:** 26 of 26 archives passed CRC/decompression checks.
- **Batch sequence:** provisional Batch 1 plus Batches 2–12 were detected. Expected split parts missing: none.
- **Batch 12 master release:** 5 files / 5481 bytes. This is not large enough to contain all nine component archives and should be treated as a release index/documentation package.
- **JSON syntax:** 0 invalid JSON files.
- **Duplicate IDs:** 5 IDs occur in multiple locations; exact duplicate packages may account for some repeats.
- **Repeated filenames:** 15 filenames appear across multiple archives.
- **Exact duplicate content:** 1 SHA-256 groups contain more than one file.

## JSON issues

- None.

## Duplicate resource IDs

- `aaa-access-review`: joseph-technologies-cybersecurity-library-v1.zip:joseph-technologies-cybersecurity-library-v1/data/resources/aaa-access-review.json; joseph-technologies-library-set-2.zip:joseph-technologies-library-set-2/metadata/aaa-access-review.json
- `privacy-impact-assessment`: joseph-technologies-cybersecurity-library-v1.zip:joseph-technologies-cybersecurity-library-v1/data/resources/privacy-impact-assessment.json; joseph-technologies-library-batch-3.zip:joseph-technologies-library-batch-3/metadata/privacy-impact-assessment.json
- `security-metrics-dashboard`: joseph-technologies-library-batch-12-part-6.zip:joseph-technologies-library-batch-12-part-6/metadata/security-metrics-dashboard.json; joseph-technologies-library-batch-5.zip:joseph-technologies-library-batch-5/metadata/security-metrics-dashboard.json
- `vendor-security-review`: joseph-technologies-cybersecurity-library-v1.zip:joseph-technologies-cybersecurity-library-v1/data/resources/vendor-security-review.json; joseph-technologies-library-batch-3.zip:joseph-technologies-library-batch-3/metadata/vendor-security-review.json
- `zero-trust-architecture-planner`: joseph-technologies-library-batch-4.zip:joseph-technologies-library-batch-4/metadata/zero-trust-architecture-planner.json; joseph-technologies-library-batch-7-part-1.zip:joseph-technologies-library-batch-7-part-1/metadata/zero-trust-architecture-planner.json

## Companion-format observations

The following table uses normalized filenames as a preliminary resource heuristic. It is not a final classification; README and manifest semantics must be considered before migration.


## Deep file and metadata validation

- Invalid XLSX/PDF/SVG containers: **0**
- Missing metadata-referenced companion files: **0**
- ID-bearing metadata records missing one or more proposed future fields: **107 of 107**

The proposed AGENTS.md metadata contract is stricter than the supplied batch schemas. Missing fields require normalization, but do not by themselves mean the underlying resource file is corrupt.

### File-container issues

- None.

### Broken metadata file references

- None.

### Metadata normalization requirements

| id | archive | path | missing |
| --- | --- | --- | --- |
| cia-triad | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/cia-triad.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| aaa-access-review | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/aaa-access-review.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| bell-lapadula | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/bell-lapadula.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| biba-integrity | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/biba-integrity.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| defense-in-depth | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/defense-in-depth.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| nist-csf-profile | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/nist-csf-profile.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| nist-rmf-plan | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/nist-rmf-plan.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| risk-register | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/risk-register.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| incident-intake | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/incident-intake.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| chain-of-custody | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/chain-of-custody.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| privacy-impact-assessment | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/privacy-impact-assessment.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| vendor-security-review | joseph-technologies-cybersecurity-library-v1.zip | joseph-technologies-cybersecurity-library-v1/data/resources/vendor-security-review.json | batch, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| secure-sdlc-companion | joseph-technologies-library-batch-10-part-1.zip | joseph-technologies-library-batch-10-part-1/metadata/secure-sdlc-companion.json | batch, formats, intendedAudience, keywords, part, status |
| devsecops-pipeline-planner | joseph-technologies-library-batch-10-part-1.zip | joseph-technologies-library-batch-10-part-1/metadata/devsecops-pipeline-planner.json | batch, formats, intendedAudience, keywords, part, status |
| security-requirements-workbook | joseph-technologies-library-batch-10-part-1.zip | joseph-technologies-library-batch-10-part-1/metadata/security-requirements-workbook.json | batch, formats, intendedAudience, keywords, part, status |
| threat-modeling-designer | joseph-technologies-library-batch-10-part-2.zip | joseph-technologies-library-batch-10-part-2/metadata/threat-modeling-designer.json | batch, formats, intendedAudience, keywords, part, status |
| security-testing-planner | joseph-technologies-library-batch-10-part-2.zip | joseph-technologies-library-batch-10-part-2/metadata/security-testing-planner.json | batch, formats, intendedAudience, keywords, part, status |
| soc-operations-manual | joseph-technologies-library-batch-11-part-1.zip | joseph-technologies-library-batch-11-part-1/metadata/soc-operations-manual.json | batch, formats, intendedAudience, keywords, part, status |
| incident-response-playbook-builder | joseph-technologies-library-batch-11-part-1.zip | joseph-technologies-library-batch-11-part-1/metadata/incident-response-playbook-builder.json | batch, formats, intendedAudience, keywords, part, status |
| digital-forensics-investigation-workbook | joseph-technologies-library-batch-11-part-1.zip | joseph-technologies-library-batch-11-part-1/metadata/digital-forensics-investigation-workbook.json | batch, formats, intendedAudience, keywords, part, status |
| threat-intelligence-management-toolkit | joseph-technologies-library-batch-11-part-2.zip | joseph-technologies-library-batch-11-part-2/metadata/threat-intelligence-management-toolkit.json | batch, formats, intendedAudience, keywords, part, status |
| detection-engineering-planner | joseph-technologies-library-batch-11-part-2.zip | joseph-technologies-library-batch-11-part-2/metadata/detection-engineering-planner.json | batch, formats, intendedAudience, keywords, part, status |
| enterprise-security-architecture-planner | joseph-technologies-library-batch-12-part-1.zip | joseph-technologies-library-batch-12-part-1/metadata/enterprise-security-architecture-planner.json | formats, intendedAudience, keywords, publisher, status, summary |
| trust-zone-designer | joseph-technologies-library-batch-12-part-1.zip | joseph-technologies-library-batch-12-part-1/metadata/trust-zone-designer.json | formats, intendedAudience, keywords, publisher, status, summary |
| network-application-architecture-workbook | joseph-technologies-library-batch-12-part-1.zip | joseph-technologies-library-batch-12-part-1/metadata/network-application-architecture-workbook.json | formats, intendedAudience, keywords, publisher, status, summary |
| reference-architecture-library | joseph-technologies-library-batch-12-part-1.zip | joseph-technologies-library-batch-12-part-1/metadata/reference-architecture-library.json | formats, intendedAudience, keywords, publisher, status, summary |
| data-flow-catalog | joseph-technologies-library-batch-12-part-1.zip | joseph-technologies-library-batch-12-part-1/metadata/data-flow-catalog.json | formats, intendedAudience, keywords, publisher, status, summary |
| cybersecurity-governance-toolkit | joseph-technologies-library-batch-12-part-2.zip | joseph-technologies-library-batch-12-part-2/metadata/cybersecurity-governance-toolkit.json | formats, intendedAudience, keywords, publisher, status, summary |
| policy-management-suite | joseph-technologies-library-batch-12-part-2.zip | joseph-technologies-library-batch-12-part-2/metadata/policy-management-suite.json | formats, intendedAudience, keywords, publisher, status, summary |
| standard-baseline-manager | joseph-technologies-library-batch-12-part-2.zip | joseph-technologies-library-batch-12-part-2/metadata/standard-baseline-manager.json | formats, intendedAudience, keywords, publisher, status, summary |
| security-exception-register | joseph-technologies-library-batch-12-part-2.zip | joseph-technologies-library-batch-12-part-2/metadata/security-exception-register.json | formats, intendedAudience, keywords, publisher, status, summary |
| security-committee-planner | joseph-technologies-library-batch-12-part-2.zip | joseph-technologies-library-batch-12-part-2/metadata/security-committee-planner.json | formats, intendedAudience, keywords, publisher, status, summary |
| executive-risk-dashboard | joseph-technologies-library-batch-12-part-3.zip | joseph-technologies-library-batch-12-part-3/metadata/executive-risk-dashboard.json | formats, intendedAudience, keywords, publisher, status, summary |
| risk-appetite-workbook | joseph-technologies-library-batch-12-part-3.zip | joseph-technologies-library-batch-12-part-3/metadata/risk-appetite-workbook.json | formats, intendedAudience, keywords, publisher, status, summary |
| kpi-kri-tracker | joseph-technologies-library-batch-12-part-3.zip | joseph-technologies-library-batch-12-part-3/metadata/kpi-kri-tracker.json | formats, intendedAudience, keywords, publisher, status, summary |
| enterprise-risk-register | joseph-technologies-library-batch-12-part-3.zip | joseph-technologies-library-batch-12-part-3/metadata/enterprise-risk-register.json | formats, intendedAudience, keywords, publisher, status, summary |
| heatmaps-board-reporting | joseph-technologies-library-batch-12-part-3.zip | joseph-technologies-library-batch-12-part-3/metadata/heatmaps-board-reporting.json | formats, intendedAudience, keywords, publisher, status, summary |
| cybersecurity-program-roadmap | joseph-technologies-library-batch-12-part-4.zip | joseph-technologies-library-batch-12-part-4/metadata/cybersecurity-program-roadmap.json | formats, intendedAudience, keywords, publisher, status, summary |
| cybersecurity-budget-planner | joseph-technologies-library-batch-12-part-4.zip | joseph-technologies-library-batch-12-part-4/metadata/cybersecurity-budget-planner.json | formats, intendedAudience, keywords, publisher, status, summary |
| security-initiative-tracker | joseph-technologies-library-batch-12-part-4.zip | joseph-technologies-library-batch-12-part-4/metadata/security-initiative-tracker.json | formats, intendedAudience, keywords, publisher, status, summary |
| security-resource-planner | joseph-technologies-library-batch-12-part-4.zip | joseph-technologies-library-batch-12-part-4/metadata/security-resource-planner.json | formats, intendedAudience, keywords, publisher, status, summary |
| security-portfolio-dashboard | joseph-technologies-library-batch-12-part-4.zip | joseph-technologies-library-batch-12-part-4/metadata/security-portfolio-dashboard.json | formats, intendedAudience, keywords, publisher, status, summary |
| internal-audit-planner | joseph-technologies-library-batch-12-part-5.zip | joseph-technologies-library-batch-12-part-5/metadata/internal-audit-planner.json | formats, intendedAudience, keywords, publisher, status, summary |
| compliance-evidence-library | joseph-technologies-library-batch-12-part-5.zip | joseph-technologies-library-batch-12-part-5/metadata/compliance-evidence-library.json | formats, intendedAudience, keywords, publisher, status, summary |
| assessment-tracker | joseph-technologies-library-batch-12-part-5.zip | joseph-technologies-library-batch-12-part-5/metadata/assessment-tracker.json | formats, intendedAudience, keywords, publisher, status, summary |
| control-testing-workbook | joseph-technologies-library-batch-12-part-5.zip | joseph-technologies-library-batch-12-part-5/metadata/control-testing-workbook.json | formats, intendedAudience, keywords, publisher, status, summary |
| continuous-compliance-dashboard | joseph-technologies-library-batch-12-part-5.zip | joseph-technologies-library-batch-12-part-5/metadata/continuous-compliance-dashboard.json | formats, intendedAudience, keywords, publisher, status, summary |
| board-reporting-suite | joseph-technologies-library-batch-12-part-6.zip | joseph-technologies-library-batch-12-part-6/metadata/board-reporting-suite.json | formats, intendedAudience, keywords, publisher, status, summary |
| quarterly-executive-report | joseph-technologies-library-batch-12-part-6.zip | joseph-technologies-library-batch-12-part-6/metadata/quarterly-executive-report.json | formats, intendedAudience, keywords, publisher, status, summary |
| security-metrics-dashboard | joseph-technologies-library-batch-12-part-6.zip | joseph-technologies-library-batch-12-part-6/metadata/security-metrics-dashboard.json | formats, intendedAudience, keywords, publisher, status, summary |
| strategic-planning-workbook | joseph-technologies-library-batch-12-part-6.zip | joseph-technologies-library-batch-12-part-6/metadata/strategic-planning-workbook.json | formats, intendedAudience, keywords, publisher, status, summary |
| maturity-tracking-suite | joseph-technologies-library-batch-12-part-6.zip | joseph-technologies-library-batch-12-part-6/metadata/maturity-tracking-suite.json | formats, intendedAudience, keywords, publisher, status, summary |
| policy-template-pack | joseph-technologies-library-batch-12-part-7.zip | joseph-technologies-library-batch-12-part-7/metadata/policy-template-pack.json | formats, intendedAudience, keywords, publisher, status, summary |
| charter-template-pack | joseph-technologies-library-batch-12-part-7.zip | joseph-technologies-library-batch-12-part-7/metadata/charter-template-pack.json | formats, intendedAudience, keywords, publisher, status, summary |
| risk-template-pack | joseph-technologies-library-batch-12-part-7.zip | joseph-technologies-library-batch-12-part-7/metadata/risk-template-pack.json | formats, intendedAudience, keywords, publisher, status, summary |
| architecture-template-pack | joseph-technologies-library-batch-12-part-7.zip | joseph-technologies-library-batch-12-part-7/metadata/architecture-template-pack.json | formats, intendedAudience, keywords, publisher, status, summary |
| meeting-assessment-template-pack | joseph-technologies-library-batch-12-part-7.zip | joseph-technologies-library-batch-12-part-7/metadata/meeting-assessment-template-pack.json | formats, intendedAudience, keywords, publisher, status, summary |
| security-architecture-diagram-kit | joseph-technologies-library-batch-12-part-8.zip | joseph-technologies-library-batch-12-part-8/metadata/security-architecture-diagram-kit.json | formats, intendedAudience, keywords, publisher, status, summary |
| governance-operating-model-kit | joseph-technologies-library-batch-12-part-8.zip | joseph-technologies-library-batch-12-part-8/metadata/governance-operating-model-kit.json | formats, intendedAudience, keywords, publisher, status, summary |
| risk-visualization-kit | joseph-technologies-library-batch-12-part-8.zip | joseph-technologies-library-batch-12-part-8/metadata/risk-visualization-kit.json | formats, intendedAudience, keywords, publisher, status, summary |
| security-process-flowchart-kit | joseph-technologies-library-batch-12-part-8.zip | joseph-technologies-library-batch-12-part-8/metadata/security-process-flowchart-kit.json | formats, intendedAudience, keywords, publisher, status, summary |
| executive-graphics-library | joseph-technologies-library-batch-12-part-8.zip | joseph-technologies-library-batch-12-part-8/metadata/executive-graphics-library.json | formats, intendedAudience, keywords, publisher, status, summary |
| master-library-index | joseph-technologies-library-batch-12-part-9.zip | joseph-technologies-library-batch-12-part-9/metadata/master-library-index.json | formats, intendedAudience, keywords, publisher, status, summary |
| metadata-catalog | joseph-technologies-library-batch-12-part-9.zip | joseph-technologies-library-batch-12-part-9/metadata/metadata-catalog.json | formats, intendedAudience, keywords, publisher, status, summary |
| search-index | joseph-technologies-library-batch-12-part-9.zip | joseph-technologies-library-batch-12-part-9/metadata/search-index.json | formats, intendedAudience, keywords, publisher, status, summary |
| version-history | joseph-technologies-library-batch-12-part-9.zip | joseph-technologies-library-batch-12-part-9/metadata/version-history.json | formats, intendedAudience, keywords, publisher, status, summary |
| contributor-licensing-guide | joseph-technologies-library-batch-12-part-9.zip | joseph-technologies-library-batch-12-part-9/metadata/contributor-licensing-guide.json | formats, intendedAudience, keywords, publisher, status, summary |
| digital-evidence-chain-of-custody | joseph-technologies-library-batch-3.zip | joseph-technologies-library-batch-3/metadata/digital-evidence-chain-of-custody.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| incident-response-command-workbook | joseph-technologies-library-batch-3.zip | joseph-technologies-library-batch-3/metadata/incident-response-command-workbook.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| privacy-impact-assessment | joseph-technologies-library-batch-3.zip | joseph-technologies-library-batch-3/metadata/privacy-impact-assessment.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| vendor-security-review | joseph-technologies-library-batch-3.zip | joseph-technologies-library-batch-3/metadata/vendor-security-review.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| digital-asset-inventory | joseph-technologies-library-batch-3.zip | joseph-technologies-library-batch-3/metadata/digital-asset-inventory.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| stride-threat-modeling-toolkit | joseph-technologies-library-batch-4.zip | joseph-technologies-library-batch-4/metadata/stride-threat-modeling-toolkit.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| dread-risk-analysis-toolkit | joseph-technologies-library-batch-4.zip | joseph-technologies-library-batch-4/metadata/dread-risk-analysis-toolkit.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| attack-tree-builder | joseph-technologies-library-batch-4.zip | joseph-technologies-library-batch-4/metadata/attack-tree-builder.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| zero-trust-architecture-planner | joseph-technologies-library-batch-4.zip | joseph-technologies-library-batch-4/metadata/zero-trust-architecture-planner.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| defense-in-depth-planner | joseph-technologies-library-batch-4.zip | joseph-technologies-library-batch-4/metadata/defense-in-depth-planner.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData |
| mitre-attack-companion | joseph-technologies-library-batch-5.zip | joseph-technologies-library-batch-5/metadata/mitre-attack-companion.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| detection-coverage-matrix | joseph-technologies-library-batch-5.zip | joseph-technologies-library-batch-5/metadata/detection-coverage-matrix.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| siem-use-case-manager | joseph-technologies-library-batch-5.zip | joseph-technologies-library-batch-5/metadata/siem-use-case-manager.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| ioc-management-workbook | joseph-technologies-library-batch-5.zip | joseph-technologies-library-batch-5/metadata/ioc-management-workbook.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| security-metrics-dashboard | joseph-technologies-library-batch-5.zip | joseph-technologies-library-batch-5/metadata/security-metrics-dashboard.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| incident-response-case-management | joseph-technologies-library-batch-6.zip | joseph-technologies-library-batch-6/metadata/incident-response-case-management.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| digital-forensics-examination | joseph-technologies-library-batch-6.zip | joseph-technologies-library-batch-6/metadata/digital-forensics-examination.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| malware-analysis-companion | joseph-technologies-library-batch-6.zip | joseph-technologies-library-batch-6/metadata/malware-analysis-companion.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| threat-hunting-operations | joseph-technologies-library-batch-6.zip | joseph-technologies-library-batch-6/metadata/threat-hunting-operations.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| purple-team-exercise-planner | joseph-technologies-library-batch-6.zip | joseph-technologies-library-batch-6/metadata/purple-team-exercise-planner.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| zero-trust-architecture-planner | joseph-technologies-library-batch-7-part-1.zip | joseph-technologies-library-batch-7-part-1/metadata/zero-trust-architecture-planner.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| network-segmentation-designer | joseph-technologies-library-batch-7-part-1.zip | joseph-technologies-library-batch-7-part-1/metadata/network-segmentation-designer.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| enterprise-security-architecture-workbook | joseph-technologies-library-batch-7-part-1.zip | joseph-technologies-library-batch-7-part-1/metadata/enterprise-security-architecture-workbook.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| identity-access-governance-planner | joseph-technologies-library-batch-7-part-2.zip | joseph-technologies-library-batch-7-part-2/metadata/identity-access-governance-planner.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| cloud-security-architecture-companion | joseph-technologies-library-batch-7-part-2.zip | joseph-technologies-library-batch-7-part-2/metadata/cloud-security-architecture-companion.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, sampleData |
| iso-27001-isms-companion | joseph-technologies-library-batch-8-part-1(1).zip | joseph-technologies-library-batch-8-part-1/metadata/iso-27001-isms-companion.json | batch, category, formats, intendedAudience, keywords, part, status |
| iso-27701-privacy-companion | joseph-technologies-library-batch-8-part-1(1).zip | joseph-technologies-library-batch-8-part-1/metadata/iso-27701-privacy-companion.json | batch, category, formats, intendedAudience, keywords, part, status |
| nist-csf-2-enterprise-planner | joseph-technologies-library-batch-8-part-1(1).zip | joseph-technologies-library-batch-8-part-1/metadata/nist-csf-2-enterprise-planner.json | batch, category, formats, intendedAudience, keywords, part, status |
| cis-controls-v8-planner | joseph-technologies-library-batch-8-part-2(1).zip | joseph-technologies-library-batch-8-part-2/metadata/cis-controls-v8-planner.json | batch, category, formats, intendedAudience, keywords, part, status |
| enterprise-compliance-crosswalk | joseph-technologies-library-batch-8-part-2(1).zip | joseph-technologies-library-batch-8-part-2/metadata/enterprise-compliance-crosswalk.json | batch, category, formats, intendedAudience, keywords, part, status |
| fair-risk-analysis-toolkit | joseph-technologies-library-batch-9-part-1.zip | joseph-technologies-library-batch-9-part-1/metadata/fair-risk-analysis-toolkit.json | batch, category, formats, intendedAudience, keywords, part, status |
| octave-risk-assessment-companion | joseph-technologies-library-batch-9-part-1.zip | joseph-technologies-library-batch-9-part-1/metadata/octave-risk-assessment-companion.json | batch, category, formats, intendedAudience, keywords, part, status |
| enterprise-risk-register-pro | joseph-technologies-library-batch-9-part-1.zip | joseph-technologies-library-batch-9-part-1/metadata/enterprise-risk-register-pro.json | batch, category, formats, intendedAudience, keywords, part, status |
| business-impact-analysis-workbook | joseph-technologies-library-batch-9-part-2.zip | joseph-technologies-library-batch-9-part-2/metadata/business-impact-analysis-workbook.json | batch, category, formats, intendedAudience, keywords, part, status |
| cyber-risk-heatmap-executive-dashboard | joseph-technologies-library-batch-9-part-2.zip | joseph-technologies-library-batch-9-part-2/metadata/cyber-risk-heatmap-executive-dashboard.json | batch, category, formats, intendedAudience, keywords, part, status |
| aaa-access-review | joseph-technologies-library-set-2.zip | joseph-technologies-library-set-2/metadata/aaa-access-review.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData, status |
| bell-lapadula-access-matrix | joseph-technologies-library-set-2.zip | joseph-technologies-library-set-2/metadata/bell-lapadula-access-matrix.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData, status |
| biba-integrity-assessment | joseph-technologies-library-set-2.zip | joseph-technologies-library-set-2/metadata/biba-integrity-assessment.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData, status |
| cybersecurity-risk-register | joseph-technologies-library-set-2.zip | joseph-technologies-library-set-2/metadata/cybersecurity-risk-register.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData, status |
| nist-csf-2-planning-companion | joseph-technologies-library-set-2.zip | joseph-technologies-library-set-2/metadata/nist-csf-2-planning-companion.json | batch, category, files, formats, intendedAudience, keywords, part, publisher, releaseDate, sampleData, status |
| batch | resource | formats | metadata |
| --- | --- | --- | --- |
| 1 | aaa-access-review | .json | present |
| 1 | bell-lapadula | .json | present |
| 1 | biba-integrity | .json | present |
| 1 | chain-of-custody | .json | present |
| 1 | cia-triad | .json, .svg | present |
| 1 | cia-triad-asset-assessment | .pdf | missing |
| 1 | cia-triad-live-risk-assessment | .xlsx | missing |
| 1 | codex-handoff | .md | missing |
| 1 | defense-in-depth | .json | present |
| 1 | diagram-schema | .json | present |
| 1 | incident-intake | .json | present |
| 1 | nist-csf-profile | .json | present |
| 1 | nist-rmf-plan | .json | present |
| 1 | official-references | .json | present |
| 1 | pdf-spec | .md | missing |
| 1 | privacy-impact-assessment | .json | present |
| 1 | resource-schema | .json | present |
| 1 | risk-register | .json | present |
| 1 | roadmap | .md | missing |
| 1 | vendor-security-review | .json | present |
| 1 | workbook-schema | .json | present |
| 1 | workbook-spec | .md | missing |
| 10 | devsecops-pipeline-planner | .json, .pdf, .svg, .xlsx | present |
| 10 | secure-sdlc-companion | .json, .pdf, .svg, .xlsx | present |
| 10 | security-requirements | .json, .pdf, .svg, .xlsx | present |
| 10 | security-testing-planner | .json, .pdf, .svg, .xlsx | present |
| 10 | threat-modeling-designer | .json, .pdf, .svg, .xlsx | present |
| 11 | detection-engineering-planner | .json, .pdf, .svg, .xlsx | present |
| 11 | digital-forensics-investigation | .json, .pdf, .svg, .xlsx | present |
| 11 | incident-response-playbook-builder | .json, .pdf, .svg, .xlsx | present |
| 11 | soc-operations-manual | .json, .pdf, .svg, .xlsx | present |
| 11 | threat-intelligence-management-toolkit | .json, .pdf, .svg, .xlsx | present |
| 12 | architecture-template-pack | .json, .pdf, .svg, .xlsx | present |
| 12 | assessment-tracker | .json, .pdf, .svg, .xlsx | present |
| 12 | board-reporting-suite | .json, .pdf, .svg, .xlsx | present |
| 12 | charter-template-pack | .json, .pdf, .svg, .xlsx | present |
| 12 | compliance-evidence-library | .json, .pdf, .svg, .xlsx | present |
| 12 | continuous-compliance-dashboard | .json, .pdf, .svg, .xlsx | present |
| 12 | contributor-licensing | .json, .pdf, .svg, .xlsx | present |
| 12 | control-testing | .json, .pdf, .svg, .xlsx | present |
| 12 | cybersecurity-budget-planner | .json, .pdf, .svg, .xlsx | present |
| 12 | cybersecurity-governance-toolkit | .json, .pdf, .svg, .xlsx | present |
| 12 | cybersecurity-program-roadmap | .json, .pdf, .svg, .xlsx | present |
| 12 | data-flow-catalog | .json, .pdf, .svg, .xlsx | present |
| 12 | enterprise-risk-register | .json, .pdf, .svg, .xlsx | present |
| 12 | enterprise-security-architecture-planner | .json, .pdf, .svg, .xlsx | present |
| 12 | executive-graphics-library | .json, .pdf, .svg, .xlsx | present |
| 12 | executive-risk-dashboard | .json, .pdf, .svg, .xlsx | present |
| 12 | governance-operating-model-kit | .json, .pdf, .svg, .xlsx | present |
| 12 | heatmaps-board-reporting | .json, .pdf, .svg, .xlsx | present |
| 12 | internal-audit-planner | .json, .pdf, .svg, .xlsx | present |
| 12 | kpi-kri-tracker | .json, .pdf, .svg, .xlsx | present |
| 12 | license-notice | .md | missing |
| 12 | master-library-index | .json, .pdf, .svg, .xlsx | present |
| 12 | master-manifest | .json | present |
| 12 | master-readme | .md | missing |
| 12 | maturity-tracking-suite | .json, .pdf, .svg, .xlsx | present |
| 12 | meeting-assessment-template-pack | .json, .pdf, .svg, .xlsx | present |
| 12 | metadata-catalog | .json, .pdf, .svg, .xlsx | present |
| 12 | network-application-architecture | .json, .pdf, .svg, .xlsx | present |
| 12 | policy-management-suite | .json, .pdf, .svg, .xlsx | present |
| 12 | policy-template-pack | .json, .pdf, .svg, .xlsx | present |
| 12 | quarterly-executive-report | .json, .pdf, .svg, .xlsx | present |
| 12 | reference-architecture-library | .json, .pdf, .svg, .xlsx | present |
| 12 | risk-appetite | .json, .pdf, .svg, .xlsx | present |
| 12 | risk-template-pack | .json, .pdf, .svg, .xlsx | present |
| 12 | risk-visualization-kit | .json, .pdf, .svg, .xlsx | present |
| 12 | search-index | .json, .pdf, .svg, .xlsx | present |
| 12 | security-architecture-diagram-kit | .json, .pdf, .svg, .xlsx | present |
| 12 | security-committee-planner | .json, .pdf, .svg, .xlsx | present |
| 12 | security-exception-register | .json, .pdf, .svg, .xlsx | present |
| 12 | security-initiative-tracker | .json, .pdf, .svg, .xlsx | present |
| 12 | security-metrics-dashboard | .json, .pdf, .svg, .xlsx | present |
| 12 | security-portfolio-dashboard | .json, .pdf, .svg, .xlsx | present |
| 12 | security-process-flowchart-kit | .json, .pdf, .svg, .xlsx | present |
| 12 | security-resource-planner | .json, .pdf, .svg, .xlsx | present |
| 12 | standard-baseline-manager | .json, .pdf, .svg, .xlsx | present |
| 12 | strategic-planning | .json, .pdf, .svg, .xlsx | present |
| 12 | trust-zone-designer | .json, .pdf, .svg, .xlsx | present |
| 12 | version-history | .json, .pdf, .svg, .xlsx | present |
| 2 | aaa-access-review | .json, .pdf, .svg, .xlsx | present |
| 2 | bell-lapadula-access-matrix | .json, .pdf, .svg, .xlsx | present |
| 2 | biba-integrity-assessment | .json, .pdf, .svg, .xlsx | present |
| 2 | cybersecurity-risk-register | .json, .pdf, .svg, .xlsx | present |
| 2 | nist-csf-2-planning-companion | .json, .pdf, .svg, .xlsx | present |
| 3 | digital-asset-inventory | .json, .pdf, .svg, .xlsx | present |
| 3 | digital-evidence-chain-of-custody | .json, .pdf, .svg, .xlsx | present |
| 3 | incident-response-command | .json, .pdf, .svg, .xlsx | present |
| 3 | integration | .md | missing |
| 3 | privacy-impact-assessment | .json, .pdf, .svg, .xlsx | present |
| 3 | vendor-security-review | .json, .pdf, .svg, .xlsx | present |
| 4 | attack-tree-builder | .json, .pdf, .svg, .xlsx | present |
| 4 | defense-in-depth-planner | .json, .pdf, .svg, .xlsx | present |
| 4 | dread-risk-analysis-toolkit | .json, .pdf, .svg, .xlsx | present |
| 4 | stride-threat-modeling-toolkit | .json, .pdf, .svg, .xlsx | present |
| 4 | website-integration | .md | missing |
| 4 | zero-trust-architecture-planner | .json, .pdf, .svg, .xlsx | present |
| 5 | detection-coverage-matrix | .json, .pdf, .svg, .xlsx | present |
| 5 | ioc-management | .json, .pdf, .svg, .xlsx | present |
| 5 | mitre-attack-companion | .json, .pdf, .svg, .xlsx | present |
| 5 | security-metrics-dashboard | .json, .pdf, .svg, .xlsx | present |
| 5 | siem-use-case-manager | .json, .pdf, .svg, .xlsx | present |
| 6 | digital-forensics-examination | .json, .pdf, .svg, .xlsx | present |
| 6 | incident-response-case-management | .json, .pdf, .svg, .xlsx | present |
| 6 | malware-analysis-companion | .json, .pdf, .svg, .xlsx | present |
| 6 | purple-team-exercise-planner | .json, .pdf, .svg, .xlsx | present |
| 6 | threat-hunting-operations | .json, .pdf, .svg, .xlsx | present |
| 7 | cloud-security-architecture-companion | .json, .pdf, .svg, .xlsx | present |
| 7 | enterprise-security-architecture | .json, .pdf, .svg, .xlsx | present |
| 7 | identity-access-governance-planner | .json, .pdf, .svg, .xlsx | present |
| 7 | network-segmentation-designer | .json, .pdf, .svg, .xlsx | present |
| 7 | zero-trust-architecture-planner | .json, .pdf, .svg, .xlsx | present |
| 8 | cis-controls-v8-planner | .json, .pdf, .svg, .xlsx | present |
| 8 | enterprise-compliance-crosswalk | .json, .pdf, .svg, .xlsx | present |
| 8 | iso-27001-isms-companion | .json, .pdf, .svg, .xlsx | present |
| 8 | iso-27701-privacy-companion | .json, .pdf, .svg, .xlsx | present |
| 8 | nist-csf-2-enterprise-planner | .json, .pdf, .svg, .xlsx | present |
| 9 | business-impact-analysis | .json, .pdf, .svg, .xlsx | present |
| 9 | cyber-risk-heatmap-executive-dashboard | .json, .pdf, .svg, .xlsx | present |
| 9 | enterprise-risk-register-pro | .json, .pdf, .svg, .xlsx | present |
| 9 | fair-risk-analysis-toolkit | .json, .pdf, .svg, .xlsx | present |
| 9 | octave-risk-assessment-companion | .json, .pdf, .svg, .xlsx | present |

## Structural risks

- Batch/part folders are useful provenance but are not an ideal permanent public-resource hierarchy.
- Identical files repeated in part archives and release packages must not be published twice.
- Metadata exists at different scopes; a canonical resource record must be selected before generating website catalogs.
- Workbook, guide, diagram, and metadata relationships must be established from manifests and resource IDs, not filenames alone.
- No archive should be classified as verified merely because it opens; companion completeness, metadata semantics, and internal references require a second-stage extracted audit.

# Pages performance measurements

Measured on 2026-07-26 using tracked files and a fresh Pages staging build.

## Before

- Tracked repository: 109,960,777 bytes across 404 files.
- Four GIF backgrounds: 58,189,733 bytes.
- Optional 3D Vatican EXR: 24,136,851 bytes.
- Initial background assignment requested three GIFs (42,575,373 bytes)
  immediately and explicitly preloaded all four.
- Existing `_site` artifact contained the EXR and all four GIFs.
- Estimated initial homepage transfer: 58,547,920 bytes across 12 core
  requests when the first three backgrounds were assigned immediately.

Untracked local toolchains, `node_modules`, `_site`, and `tmp` explain the much
larger 717,498,320-byte working-directory footprint and are not repository or
deployment content.

## Decisions

- Retained all source-quality GIFs because no lossless, compatibility-tested
  conversion source was available in this phase.
- Removed eager preload and initial assignment of three different GIFs.
  Rotation now fetches each optional background when it is first needed.
- Retained the EXR in Git for the optional 3D cinematic implementation.
- Excluded `assets/hdr` from Pages while `USE_STATIC_CINEMATIC` is enabled.
  Static WebP Earth/Vatican fallbacks remain deployed.
- Retained Three.js, MapLibre, fonts, PDFs, project evidence, and data after
  reference and runtime-path review.

The Pages exclusion must be removed before changing
`USE_STATIC_CINEMATIC` to `false`.

## After

- Fresh Pages staging artifact: 84,892,024 bytes across 334 files.
- Artifact reduction: 24,136,851 bytes (the undeployed EXR).
- Estimated initial homepage transfer: 13,225,282 bytes across 12 core
  requests before later background rotations.
- Estimated initial transfer reduction: 45,322,638 bytes.
- Removed source bytes: zero; source-quality cinematic assets remain tracked.
- Browser cache/profile duplicates in tracked files and staging: zero.

Console and visual validation in a real browser was not available in this
phase. Executable staging tests, asset-path verification, JavaScript syntax,
and the full website test suite passed.

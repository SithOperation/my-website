# X pipeline responsibilities and dependency cleanup

## Responsibility map

| Responsibility | Owner |
|---|---|
| Official X API collection | `x-sources` |
| Source schema validation | Both repositories at their trust boundary |
| Retention and candidate deduplication | `x-sources` |
| Report normalization | Website |
| Intelligence-event correlation | Website |
| Report-level GeoJSON generation | Website |
| Exact-commit synchronization | Website workflow |
| Marker rendering and generation refresh | Website frontend |

## Phase 17 dependency review

Before cleanup, the website loader optionally fetched public X HTML and added
temporary fetch metadata. That duplicated ingestion responsibility, bypassed
the producer manifest, and was disabled during normal operation. It has been
removed; the loader now only validates and copies synchronized report objects.

`assets/vendor/gsap/index.js` imported a missing `CSSPlugin.js` and was not
referenced by HTML, JavaScript modules, manifests, tests, or deployment logic.
Its sole dependency, `gsap-core.js`, was likewise reachable only through that
unused broken entry point. Both were removed. The actually loaded,
self-contained `gsap.min.js` remains and includes CSSPlugin.

In `x-sources`, `ConfidenceScorer`, `Geocoder`, and `JsonCache` remain explicit
extension boundaries from the intended ingestion architecture. The active
collector uses `EventClassifier`; its result is not dead. Removing these
boundaries would not reduce duplicate production responsibility and is
deferred until their future provider interfaces are designed.

URL canonicalization remains implemented independently at each repository
trust boundary. Sharing code across private repositories would couple
deployments; matching contract fixtures enforce equivalent behavior instead.

# X pipeline responsibilities and dependency cleanup

## Responsibility map

| Responsibility | Owner |
|---|---|
| Official X API collection | Sentinel Grid |
| Source schema validation | Sentinel Grid and website sync boundary |
| Retention and candidate deduplication | Sentinel Grid shared pipeline |
| Report normalization | Sentinel Grid |
| Intelligence-event integration | Sentinel Grid |
| Report-level GeoJSON generation | Sentinel Grid |
| Manifest synchronization | Normal website monitor sync |
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

The standalone `x-sources` producer and dispatch workflow are no longer part of
the production path. URL validation remains at the website trust boundary for
defense in depth.

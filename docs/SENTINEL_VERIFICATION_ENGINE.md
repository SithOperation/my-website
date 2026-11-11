# Sentinel verification engine

The optional free-source collector now publishes explainable candidate-event
classification and verification metadata alongside each headline. The
existing `data/map_events.json` publication remains authoritative for plotted
map events; this layer does not promote an RSS headline to a map coordinate.

## Detection

Rules live in `config/sentinel_keywords.json`. Each category has primary terms,
related terms, exclusions, context requirements, and a subcategory. Matching is
performed per sentence after Unicode normalization. A related term without an
action context is ignored, and exclusion phrases such as “missile defense
exercise” and “nuclear negotiations” suppress a candidate. Native-language
variants are kept in the dictionary and the original headline/language remain
in the publication.

Detection is a candidate signal, not confirmation. Historical, hypothetical,
negated, correction, and retraction language is retained as metadata and never
silently converted into a current threat.

## Verification and scoring

`collectors/sentinel_verification.py` groups close title/category/country/time
matches and counts independent source groups, not article copies. A source may
declare an `independence_group` so syndicated or mirrored reports do not count
as separate corroboration. Official sources are explicitly marked in the
registry and are attributed to the issuing publisher.

Statuses are `unverified`, `single-source report`, `corroborated`,
`officially confirmed`, `disputed`, `debunked`, and `retracted`. The score is a
0–100 explainability aid, not a probability: it combines independent-source
support, official-source metadata, timestamp completeness, and contradiction
penalties. Severity is stored separately and cannot upgrade verification.

The `verification` object preserves source URLs, contradiction references,
source count, last-check time, and an explanation. The map drawer displays
these fields for news records and preserves the older fields for compatibility.

## Limitations

Keyword matching cannot establish truth, infer an event location, or replace
category-specific authorities. Earthquake, space-weather, cyber, government,
infrastructure, and military claims require the relevant authoritative or
technical evidence before they should be described as confirmed. Offline or
failed collection must retain the last-known-good publication and must not
increase confidence without new evidence.

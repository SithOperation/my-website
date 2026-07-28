"""Strict validation for a synchronized Sentinel source feed."""

from __future__ import annotations

import re
from datetime import UTC, datetime

SCHEMA_VERSION = "1.0"
HEALTH_STATES = {"fresh", "stale", "partial", "unavailable"}
_SHA256 = re.compile(r"^sha256:[0-9a-f]{64}$")


def _mapping(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def _timestamp(value: object, label: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be an ISO 8601 timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{label} must be an ISO 8601 timestamp") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"{label} must include a timezone")
    return parsed.astimezone(UTC)


def validate_document(
    value: object,
    label: str,
    *,
    publication_id: str,
    now: datetime,
) -> dict[str, object]:
    document = _mapping(value, label)
    required = {
        "schema_version",
        "publication_id",
        "generated_at",
        "count",
        "health",
        "items",
    }
    if set(document) != required or document.get("schema_version") != SCHEMA_VERSION:
        raise ValueError(f"{label} has an unexpected shape")
    if document.get("publication_id") != publication_id:
        raise ValueError(f"{label} publication ID does not match the manifest")
    _timestamp(document.get("generated_at"), f"{label}.generated_at")
    items = document.get("items")
    if not isinstance(items, list) or document.get("count") != len(items):
        raise ValueError(f"{label}.count does not match items")
    health = _mapping(document.get("health"), f"{label}.health")
    if health.get("status") not in HEALTH_STATES or not isinstance(
        health.get("sources"), list
    ):
        raise ValueError(f"{label}.health is invalid")
    ids: set[str] = set()
    reference = now.astimezone(UTC)
    for index, raw in enumerate(items):
        item = _mapping(raw, f"{label}.items[{index}]")
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id or item_id in ids:
            raise ValueError(f"{label}.items[{index}] has an invalid or duplicate ID")
        ids.add(item_id)
        if item.get("feed_eligible") is not True:
            raise ValueError(f"{label}.items[{index}] is not feed eligible")
        if (
            _timestamp(item.get("expires_at"), f"{label}.items[{index}].expires_at")
            < reference
        ):
            raise ValueError(f"{label}.items[{index}] is expired")
        content_hash = item.get("content_hash")
        if not isinstance(content_hash, str) or _SHA256.fullmatch(content_hash) is None:
            raise ValueError(f"{label}.items[{index}] has an invalid content hash")
        for field in (
            "location_confidence",
            "claim_confidence",
            "association_confidence",
        ):
            confidence = item.get(field)
            if (
                isinstance(confidence, bool)
                or not isinstance(confidence, (int, float))
                or not 0 <= confidence <= 1
            ):
                raise ValueError(f"{label}.items[{index}].{field} is invalid")
    return document

"""Validation constants and stable identifiers for X early reports."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

SOURCE_CLASSES = {
    "official_military", "official_government", "major_news", "local_news",
    "social_media_osint", "social_media_aggregator", "social_media_monitor",
    "unknown_social_media",
}
LOCATION_PRECISIONS = {
    "exact", "facility", "facility_approximate", "city",
    "regional_approximate", "country", "unknown",
}
SOURCE_STATUSES = {
    "single-source report", "multiple-source report", "official-source report",
    "disputed report", "unable to verify",
}
VERIFICATION_STATUS = "not independently verified"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _digest(prefix: str, values: list[Any]) -> str:
    payload = json.dumps(values, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return f"{prefix}-{hashlib.sha256(payload.encode('utf-8')).hexdigest()[:20]}"


def stable_report_id(report: dict[str, Any]) -> str:
    return _digest("x-report", [report.get("url"), report.get("account"), report.get("text"), report.get("published_at")])


def stable_claim_id(report: dict[str, Any]) -> str:
    # Reposts hash the referenced origin; direct reports hash their own URL. This
    # makes every explicit source chain converge on the same canonical claim.
    origin = report.get("reposted_from") or report.get("quoted_source") or report.get("url")
    return _digest("x-claim", [str(origin).strip().lower()])

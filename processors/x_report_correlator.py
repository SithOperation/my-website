"""Geographic and claim-aware correlation for early reports."""

from __future__ import annotations

import hashlib
import math
from typing import Any

from models.x_report_model import VERIFICATION_STATUS, utc_now

UNRELIABLE_PRECISIONS = {"country", "unknown"}
OFFICIAL_CLASSES = {"official_military", "official_government"}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def event_types_similar(left: str, right: str) -> bool:
    def tokens(value: str) -> set[str]:
        ignored = {"reported", "report", "official", "statement", "alleged"}
        return {part for part in value.lower().replace("-", "_").split("_") if part and part not in ignored}
    a, b = tokens(left), tokens(right)
    return left == right or bool(a and b and (a & b))


def count_independent_sources(reports: list[dict[str, Any]]) -> int:
    return len({report["claim_id"] for report in reports})


def _can_merge(report: dict[str, Any], cluster: list[dict[str, Any]], radius_km: float) -> bool:
    if report["location_precision"] in UNRELIABLE_PRECISIONS:
        return False
    for existing in cluster:
        if existing["location_precision"] in UNRELIABLE_PRECISIONS:
            continue
        same_claim = report["claim_id"] == existing["claim_id"]
        similar_event = event_types_similar(report["event_type"], existing["event_type"])
        if haversine_km(report["latitude"], report["longitude"], existing["latitude"], existing["longitude"]) <= radius_km and (same_claim or similar_event):
            return True
    return False


def correlate_reports(reports: list[dict[str, Any]], radius_km: float = 125.0, updated_at: str | None = None) -> list[dict[str, Any]]:
    groups: list[list[dict[str, Any]]] = []
    for report in reports:
        group = next((candidate for candidate in groups if _can_merge(report, candidate, radius_km)), None)
        (group if group is not None else groups.append([report]))
        if group is None:
            continue
        group.append(report)
    return [_build_event(group, updated_at or utc_now()) for group in groups]


def _build_event(reports: list[dict[str, Any]], updated_at: str) -> dict[str, Any]:
    independent = count_independent_sources(reports)
    official = any(r["source_class"] in OFFICIAL_CLASSES for r in reports)
    unreliable = all(r["location_precision"] in UNRELIABLE_PRECISIONS for r in reports)
    event_types = sorted({r["event_type"] for r in reports})
    disputed = len(event_types) > 1 and not all(event_types_similar(event_types[0], item) for item in event_types[1:])
    status = "unable to verify" if unreliable else "disputed report" if disputed else "official-source report" if official else "multiple-source report" if independent >= 2 else "single-source report"
    location = reports[0]["location_name"]
    identifier = hashlib.sha256("|".join(sorted(r["id"] for r in reports)).encode()).hexdigest()[:20]
    return {
        "id": f"x-event-{identifier}", "layer": "Social Media Early Reports",
        "title": f"Early report: {location}", "summary": reports[0]["text"],
        "source_status": status, "verification_status": VERIFICATION_STATUS,
        "independent_source_count": independent, "report_count": len(reports),
        "accounts": sorted({r["account"] for r in reports}),
        "source_classes": sorted({r["source_class"] for r in reports}), "event_types": event_types,
        "location_name": location, "latitude": sum(r["latitude"] for r in reports) / len(reports),
        "longitude": sum(r["longitude"] for r in reports) / len(reports),
        "location_precision": reports[0]["location_precision"],
        "first_reported_at": min((r["published_at"] for r in reports if r["published_at"]), default=None),
        "last_updated_at": updated_at, "source_urls": sorted({r["url"] for r in reports}), "reports": reports,
    }

"""Deterministic graph correlation for X early-report intelligence events."""

from __future__ import annotations

import hashlib
import math
from typing import Any

from models.x_report_model import VERIFICATION_STATUS, utc_now

UNRELIABLE_PRECISIONS = {"country", "unknown"}
OFFICIAL_CLASSES = {"official_military", "official_government"}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in kilometers."""
    radius = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = (
        math.sin(dp / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def event_types_similar(left: str, right: str) -> bool:
    """Return whether normalized event-type vocabularies overlap."""

    def tokens(value: str) -> set[str]:
        ignored = {"reported", "report", "official", "statement", "alleged"}
        return {
            part
            for part in value.lower().replace("-", "_").split("_")
            if part and part not in ignored
        }

    a, b = tokens(left), tokens(right)
    return left == right or bool(a and b and (a & b))


def account_identity(report: dict[str, Any]) -> str:
    """Return the normalized publisher identity used for independence counts."""
    return str(report["account"]).strip().lstrip("@").casefold()


def source_identity(report: dict[str, Any]) -> str:
    """Return the independent reporting source identity.

    For this configured X feed, the monitored publishing account is the source;
    post and claim identifiers do not create extra independent publishers.
    """

    return account_identity(report)


def claim_identity(report: dict[str, Any]) -> str:
    """Return the normalized content-chain identity."""
    return str(report["claim_id"])


def count_independent_sources(reports: list[dict[str, Any]]) -> int:
    """Count distinct normalized publishing accounts."""
    return len({source_identity(report) for report in reports})


def _reports_connect(
    left: dict[str, Any],
    right: dict[str, Any],
    radius_km: float,
) -> bool:
    """Return whether two reports form one graph edge."""
    if (
        left["location_precision"] in UNRELIABLE_PRECISIONS
        or right["location_precision"] in UNRELIABLE_PRECISIONS
    ):
        return False
    nearby = (
        haversine_km(
            left["latitude"],
            left["longitude"],
            right["latitude"],
            right["longitude"],
        )
        <= radius_km
    )
    return nearby and (
        claim_identity(left) == claim_identity(right)
        or event_types_similar(left["event_type"], right["event_type"])
    )


def correlate_reports(
    reports: list[dict[str, Any]],
    radius_km: float = 125.0,
    updated_at: str | None = None,
) -> list[dict[str, Any]]:
    """Build deterministic connected components independent of input order."""
    ordered = sorted(reports, key=lambda report: str(report["id"]))
    parents = list(range(len(ordered)))

    def find(index: int) -> int:
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(left: int, right: int) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parents[max(left_root, right_root)] = min(left_root, right_root)

    for left in range(len(ordered)):
        for right in range(left + 1, len(ordered)):
            if _reports_connect(ordered[left], ordered[right], radius_km):
                union(left, right)

    components: dict[int, list[dict[str, Any]]] = {}
    for index, report in enumerate(ordered):
        components.setdefault(find(index), []).append(report)
    events = [
        _build_event(component, updated_at or utc_now())
        for component in components.values()
    ]
    return sorted(events, key=lambda event: str(event["id"]))


def _build_event(
    reports: list[dict[str, Any]], fallback_updated_at: str
) -> dict[str, Any]:
    """Build one stable intelligence event from a connected component."""
    reports = sorted(
        reports,
        key=lambda report: (
            str(report.get("published_at") or ""),
            str(report["id"]),
        ),
    )
    independent = count_independent_sources(reports)
    official = any(r["source_class"] in OFFICIAL_CLASSES for r in reports)
    unreliable = all(
        r["location_precision"] in UNRELIABLE_PRECISIONS for r in reports
    )
    event_types = sorted({r["event_type"] for r in reports})
    disputed = len(event_types) > 1 and not all(
        event_types_similar(event_types[0], item) for item in event_types[1:]
    )
    status = (
        "unable to verify"
        if unreliable
        else "disputed report"
        if disputed
        else "official-source report"
        if official
        else "multiple-source report"
        if independent >= 2
        else "single-source report"
    )
    anchor = reports[0]
    # Event identity is anchored to the earliest report. Adding an unrelated
    # report or a later corroboration cannot renumber existing events.
    identifier = hashlib.sha256(str(anchor["id"]).encode()).hexdigest()[:20]
    last_updated = max(
        (
            str(report.get("collected_at") or report.get("published_at") or "")
            for report in reports
        ),
        default=fallback_updated_at,
    )
    return {
        "id": f"x-event-{identifier}",
        "layer": "Social Media Early Reports",
        "title": f"Early report: {anchor['location_name']}",
        "summary": anchor["summary"],
        "source_status": status,
        "verification_status": VERIFICATION_STATUS,
        "independent_source_count": independent,
        "report_count": len(reports),
        "accounts": sorted({r["account"] for r in reports}, key=str.casefold),
        "source_classes": sorted({r["source_class"] for r in reports}),
        "event_types": event_types,
        "location_name": anchor["location_name"],
        "latitude": sum(r["latitude"] for r in reports) / len(reports),
        "longitude": sum(r["longitude"] for r in reports) / len(reports),
        "location_precision": anchor["location_precision"],
        "first_reported_at": min(
            (r["published_at"] for r in reports if r["published_at"]),
            default=None,
        ),
        "last_updated_at": last_updated,
        "source_urls": sorted({r["source_url"] for r in reports}),
        "reports": reports,
    }

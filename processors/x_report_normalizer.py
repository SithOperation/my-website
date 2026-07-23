"""Normalize collected X reports into the cautious Sentinel schema."""

from __future__ import annotations

from typing import Any

from models.x_report_model import LOCATION_PRECISIONS, SOURCE_CLASSES, VERIFICATION_STATUS, stable_claim_id, stable_report_id, utc_now


def normalize_report(source: dict[str, Any], collected_at: str | None = None) -> dict[str, Any]:
    source_class = source.get("source_class")
    precision = source.get("location_precision")
    if source_class not in SOURCE_CLASSES:
        raise ValueError(f"unsupported source_class: {source_class}")
    if precision not in LOCATION_PRECISIONS:
        raise ValueError(f"unsupported location_precision: {precision}")
    latitude, longitude = float(source["latitude"]), float(source["longitude"])
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise ValueError("coordinates are outside valid ranges")
    report = {
        "url": source["url"], "account": str(source["account"]).lstrip("@"),
        "text": source.get("text") or source.get("fetched_text") or "Report text unavailable.",
        "published_at": source.get("published_at"), "collected_at": collected_at or utc_now(),
        "source_class": source_class, "location_name": source["location_name"],
        "latitude": latitude, "longitude": longitude, "location_precision": precision,
        "event_type": source["event_type"], "verification_status": VERIFICATION_STATUS,
        "source_status": "single-source report", "quoted_source": source.get("quoted_source"),
        "reposted_from": source.get("reposted_from"), "fetch_attempted": bool(source.get("fetch_attempted")),
        "fetch_succeeded": bool(source.get("fetch_succeeded")), "fetch_error": source.get("fetch_error"),
    }
    report["id"] = stable_report_id(report)
    report["claim_id"] = source.get("claim_id") or stable_claim_id(report)
    return report


def normalize_reports(sources: list[dict[str, Any]], collected_at: str | None = None) -> list[dict[str, Any]]:
    return [normalize_report(source, collected_at) for source in sources]

"""Normalize validated X reports and enforce the map retention window."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from models.x_report_contract import RETENTION_HOURS
from models.x_report_model import stable_claim_id, stable_report_id

LOGGER = logging.getLogger(__name__)


def _parse_timestamp(value: str) -> datetime:
    """Parse a contract-validated timestamp as UTC."""

    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def normalize_report(source: dict[str, Any]) -> dict[str, Any]:
    """Add stable internal identities without discarding contract metadata."""

    report = dict(source)
    report["id"] = stable_report_id(report)
    report["claim_id"] = stable_claim_id(report)
    report["source_status"] = "single-source report"
    return report


def normalize_reports(
    sources: list[dict[str, Any]],
    *,
    now: datetime | None = None,
    retention_hours: int = RETENTION_HOURS,
) -> list[dict[str, Any]]:
    """Return deterministic normalized reports inside the retention window."""

    reference = (now or datetime.now(UTC)).astimezone(UTC)
    cutoff = reference - timedelta(hours=retention_hours)
    retained = [
        normalize_report(source)
        for source in sources
        if cutoff <= _parse_timestamp(source["published_at"]) <= reference
    ]
    retained.sort(
        key=lambda report: (report["published_at"], report["status_id"]),
        reverse=True,
    )
    LOGGER.info(
        "[X REPORTS] Retained %d of %d reports for the map window",
        len(retained),
        len(sources),
    )
    return retained

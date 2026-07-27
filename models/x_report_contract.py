"""Strict, versioned validation for the shared X report data contract."""

from __future__ import annotations

import math
import re
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

SCHEMA_VERSION = "1.0"
RETENTION_HOURS = 48
FUTURE_SKEW_MINUTES = 10
EVENT_TYPES = frozenset(
    {
        "reported_attack",
        "reported_military_activity",
        "reported_strike",
        "unclassified_early_report",
    }
)
SOURCE_CLASSES = frozenset(
    {
        "social_media_aggregator",
        "social_media_monitor",
        "social_media_osint",
        "unknown_social_media",
    }
)
VERIFICATION_STATUSES = frozenset(
    {
        "corroborated",
        "disputed",
        "not_independently_verified",
        "unable_to_verify",
        "verified",
    }
)
LOCATION_PRECISIONS = frozenset(
    {
        "city",
        "country",
        "exact",
        "facility",
        "facility_approximate",
        "regional_approximate",
        "unknown",
    }
)
REPORT_FIELDS = frozenset(
    {
        "account",
        "collected_at",
        "confidence",
        "event_type",
        "latitude",
        "location_name",
        "location_precision",
        "longitude",
        "published_at",
        "quoted_url",
        "reposted_url",
        "schema_version",
        "source_class",
        "source_url",
        "status_id",
        "summary",
        "verification_status",
    }
)
REQUIRED_REPORT_FIELDS = REPORT_FIELDS - {"quoted_url", "reposted_url"}
_HANDLE = re.compile(r"^[A-Za-z0-9_]{1,15}$")
_STATUS_PATH = re.compile(r"^/([A-Za-z0-9_]{1,15})/status/([0-9]+)$")


def _require_string(value: object, label: str) -> str:
    """Return a non-empty string without coercing its type."""

    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string")
    return value


def _parse_timestamp(value: object, label: str) -> datetime:
    """Parse a timezone-aware ISO 8601 timestamp."""

    timestamp = _require_string(value, label)
    try:
        parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{label} must be a valid ISO 8601 timestamp") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"{label} must include a timezone offset")
    return parsed.astimezone(UTC)


def canonical_x_url(value: object, label: str) -> tuple[str, str]:
    """Validate a canonical X status URL and return its account and status ID."""

    url = _require_string(value, label)
    parsed = urlsplit(url)
    match = _STATUS_PATH.fullmatch(parsed.path)
    if (
        parsed.scheme != "https"
        or parsed.netloc != "x.com"
        or parsed.query
        or parsed.fragment
        or match is None
        or url != f"https://x.com{parsed.path}"
    ):
        raise ValueError(
            f"{label} must be a canonical https://x.com/<account>/status/<id> URL"
        )
    return match.group(1), match.group(2)


def _require_number(value: object, label: str) -> float:
    """Return a finite JSON number while rejecting Boolean values."""

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a finite number")
    numeric = float(value)
    if not math.isfinite(numeric):
        raise ValueError(f"{label} must be a finite number")
    return numeric


def _require_enum(value: object, allowed: frozenset[str], label: str) -> str:
    """Return a string that belongs to the supplied enumeration."""

    text = _require_string(value, label)
    if text not in allowed:
        raise ValueError(f"{label} has an unsupported value: {text}")
    return text


def validate_report(
    value: object,
    label: str,
    *,
    now: datetime,
    retention_hours: int,
) -> None:
    """Validate one report against the shared contract."""

    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    fields = set(value)
    missing = sorted(REQUIRED_REPORT_FIELDS - fields)
    if missing:
        raise ValueError(f"{label} is missing: {', '.join(missing)}")
    unknown = sorted(fields - REPORT_FIELDS)
    if unknown:
        raise ValueError(f"{label} contains unsupported fields: {', '.join(unknown)}")
    if value["schema_version"] != SCHEMA_VERSION:
        raise ValueError(f"{label}.schema_version must equal {SCHEMA_VERSION}")

    status_id = _require_string(value["status_id"], f"{label}.status_id")
    if not status_id.isdecimal():
        raise ValueError(f"{label}.status_id must contain only digits")
    account = _require_string(value["account"], f"{label}.account")
    if _HANDLE.fullmatch(account) is None:
        raise ValueError(f"{label}.account must be a normalized X handle without @")
    url_account, url_status_id = canonical_x_url(
        value["source_url"], f"{label}.source_url"
    )
    if url_account.casefold() != account.casefold():
        raise ValueError(f"{label}.source_url account must match account")
    if url_status_id != status_id:
        raise ValueError(f"{label}.status_id must match source_url")

    published_at = _parse_timestamp(value["published_at"], f"{label}.published_at")
    collected_at = _parse_timestamp(value["collected_at"], f"{label}.collected_at")
    reference = now.astimezone(UTC)
    future_limit = reference + timedelta(minutes=FUTURE_SKEW_MINUTES)
    if published_at > future_limit:
        raise ValueError(f"{label}.published_at is implausibly in the future")
    if collected_at > future_limit:
        raise ValueError(f"{label}.collected_at is implausibly in the future")
    if published_at < reference - timedelta(hours=retention_hours):
        raise ValueError(f"{label}.published_at is outside the retention window")

    _require_string(value["summary"], f"{label}.summary")
    _require_enum(value["event_type"], EVENT_TYPES, f"{label}.event_type")
    _require_enum(value["source_class"], SOURCE_CLASSES, f"{label}.source_class")
    _require_enum(
        value["verification_status"],
        VERIFICATION_STATUSES,
        f"{label}.verification_status",
    )
    confidence = _require_number(value["confidence"], f"{label}.confidence")
    if not 0.0 <= confidence <= 1.0:
        raise ValueError(f"{label}.confidence must be between 0 and 1")
    latitude = _require_number(value["latitude"], f"{label}.latitude")
    longitude = _require_number(value["longitude"], f"{label}.longitude")
    if not -90.0 <= latitude <= 90.0:
        raise ValueError(f"{label}.latitude must be between -90 and 90")
    if not -180.0 <= longitude <= 180.0:
        raise ValueError(f"{label}.longitude must be between -180 and 180")
    _require_string(value["location_name"], f"{label}.location_name")
    _require_enum(
        value["location_precision"],
        LOCATION_PRECISIONS,
        f"{label}.location_precision",
    )
    for field in ("quoted_url", "reposted_url"):
        optional_url = value.get(field)
        if optional_url is not None:
            canonical_x_url(optional_url, f"{label}.{field}")


def validate_document(
    value: object,
    label: str = "x_sources.json",
    *,
    now: datetime | None = None,
    retention_hours: int = RETENTION_HOURS,
) -> None:
    """Validate a complete X sources document, including duplicate detection."""

    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object")
    if set(value) != {"schema_version", "reports"}:
        raise ValueError(f"{label} must contain only schema_version and reports")
    if value["schema_version"] != SCHEMA_VERSION:
        raise ValueError(f"{label}.schema_version must equal {SCHEMA_VERSION}")
    reports = value["reports"]
    if not isinstance(reports, list):
        raise ValueError(f"{label}.reports must be a JSON array")
    reference = now or datetime.now(UTC)
    seen_status_ids: set[str] = set()
    seen_urls: set[str] = set()
    for index, report in enumerate(reports):
        report_label = f"{label}.reports[{index}]"
        validate_report(
            report,
            report_label,
            now=reference,
            retention_hours=retention_hours,
        )
        assert isinstance(report, dict)
        status_id = report["status_id"]
        source_url = report["source_url"]
        if status_id in seen_status_ids:
            raise ValueError(f"{report_label}.status_id is duplicated")
        if source_url in seen_urls:
            raise ValueError(f"{report_label}.source_url is duplicated")
        seen_status_ids.add(status_id)
        seen_urls.add(source_url)

"""Transactional publication for the paired X event and GeoJSON outputs."""

from __future__ import annotations

import json
import logging
import math
import os
import re
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from models.x_report_model import stable_report_id

LOGGER = logging.getLogger(__name__)
SCHEMA_VERSION = "1.0"
EVENT_FILENAME = "x_report_events.json"
GEOJSON_FILENAME = "x_report_pinpoints.geojson"
ReplaceFunction = Callable[[str | Path, str | Path], None]
SerializerFunction = Callable[[object], bytes]
_GENERATION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_REPORT_METADATA_FIELDS = (
    "account",
    "collected_at",
    "confidence",
    "event_type",
    "id",
    "latitude",
    "location_name",
    "location_precision",
    "longitude",
    "published_at",
    "schema_version",
    "source_class",
    "source_url",
    "status_id",
    "summary",
    "verification_status",
)


class OutputValidationError(ValueError):
    """Raised when a generated output document violates its contract."""


class OutputStagingError(OSError):
    """Raised when a complete output pair cannot be durably staged."""


class OutputPublicationError(OSError):
    """Raised when publication fails but the prior pair is restored."""


class OutputRollbackError(OSError):
    """Raised when publication and subsequent rollback both fail."""


def create_generation_metadata(
    *,
    now: datetime | None = None,
    generation_id: str | None = None,
) -> dict[str, str]:
    """Create shared schema, identifier, and timestamp metadata."""

    timestamp = (now or datetime.now(UTC)).astimezone(UTC).replace(microsecond=0)
    generated_at = timestamp.isoformat().replace("+00:00", "Z")
    identifier = generation_id or (
        f"{timestamp.strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    )
    if _GENERATION_ID.fullmatch(identifier) is None:
        raise OutputValidationError("generation_id contains unsafe path characters")
    return {
        "schema_version": SCHEMA_VERSION,
        "generation_id": identifier,
        "generated_at": generated_at,
    }


def build_event_document(
    events: list[dict[str, Any]],
    metadata: dict[str, str],
) -> dict[str, Any]:
    """Wrap correlated events in generation metadata."""

    return {**metadata, "events": events}


def add_geojson_metadata(
    geojson: dict[str, Any],
    metadata: dict[str, str],
) -> dict[str, Any]:
    """Add generation metadata as valid top-level GeoJSON foreign members."""

    return {**geojson, **metadata}


def _require_metadata(document: dict[str, Any], label: str) -> tuple[str, str, str]:
    """Validate and return the shared generation metadata tuple."""

    schema_version = document.get("schema_version")
    generation_id = document.get("generation_id")
    generated_at = document.get("generated_at")
    if schema_version != SCHEMA_VERSION:
        raise OutputValidationError(
            f"{label}.schema_version must equal {SCHEMA_VERSION}"
        )
    if not isinstance(generation_id, str) or not generation_id:
        raise OutputValidationError(f"{label}.generation_id must be non-empty")
    if not isinstance(generated_at, str) or not generated_at:
        raise OutputValidationError(f"{label}.generated_at must be non-empty")
    try:
        parsed = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise OutputValidationError(f"{label}.generated_at must be ISO 8601") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise OutputValidationError(f"{label}.generated_at must include a timezone")
    return schema_version, generation_id, generated_at


def _require_finite_coordinate(value: object, label: str) -> float:
    """Return a finite coordinate without accepting Boolean values."""

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise OutputValidationError(f"{label} must be a finite number")
    coordinate = float(value)
    if not math.isfinite(coordinate):
        raise OutputValidationError(f"{label} must be a finite number")
    return coordinate


def validate_output_pair(
    event_document: object,
    geojson_document: object,
    *,
    expected_report_count: int,
) -> None:
    """Validate both generated outputs and their shared generation identity."""

    if not isinstance(event_document, dict):
        raise OutputValidationError("event output must be a JSON object")
    if set(event_document) != {
        "schema_version",
        "generation_id",
        "generated_at",
        "events",
    }:
        raise OutputValidationError("event output has an unexpected top-level shape")
    events = event_document.get("events")
    if not isinstance(events, list):
        raise OutputValidationError("event output events must be an array")

    if not isinstance(geojson_document, dict):
        raise OutputValidationError("GeoJSON output must be a JSON object")
    if geojson_document.get("type") != "FeatureCollection":
        raise OutputValidationError("GeoJSON type must be FeatureCollection")
    features = geojson_document.get("features")
    if not isinstance(features, list):
        raise OutputValidationError("GeoJSON features must be an array")
    if len(features) != expected_report_count:
        raise OutputValidationError(
            "GeoJSON feature count must equal accepted report count"
        )

    event_metadata = _require_metadata(event_document, "events")
    geojson_metadata = _require_metadata(geojson_document, "geojson")
    if event_metadata != geojson_metadata:
        raise OutputValidationError("generated outputs have mismatched metadata")

    event_report_ids: set[str] = set()
    for event_index, event in enumerate(events):
        if not isinstance(event, dict):
            raise OutputValidationError(f"events[{event_index}] must be a JSON object")
        reports = event.get("reports")
        if not isinstance(reports, list) or not reports:
            raise OutputValidationError(
                f"events[{event_index}].reports must be a non-empty array"
            )
        for report_index, report in enumerate(reports):
            if not isinstance(report, dict):
                raise OutputValidationError(
                    f"events[{event_index}].reports[{report_index}] "
                    "must be a JSON object"
                )
            for field in _REPORT_METADATA_FIELDS:
                if field not in report:
                    raise OutputValidationError(
                        f"events[{event_index}].reports[{report_index}] "
                        f"is missing {field}"
                    )
            report_id = report["id"]
            if not isinstance(report_id, str) or not report_id:
                raise OutputValidationError(
                    f"events[{event_index}].reports[{report_index}].id "
                    "must be non-empty"
                )
            event_report_ids.add(report_id)

    feature_report_ids: set[str] = set()
    for index, feature in enumerate(features):
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise OutputValidationError(f"features[{index}] must be a Feature")
        feature_id = feature.get("id")
        properties = feature.get("properties")
        geometry = feature.get("geometry")
        if not isinstance(feature_id, str) or not feature_id:
            raise OutputValidationError(f"features[{index}].id must be non-empty")
        if feature_id in feature_report_ids:
            raise OutputValidationError(f"features[{index}].id is duplicated")
        feature_report_ids.add(feature_id)
        if not isinstance(properties, dict) or properties.get("id") != feature_id:
            raise OutputValidationError(
                f"features[{index}] properties must preserve its report ID"
            )
        for field in _REPORT_METADATA_FIELDS:
            if field not in properties:
                raise OutputValidationError(
                    f"features[{index}].properties is missing {field}"
                )
        if stable_report_id(properties) != feature_id:
            raise OutputValidationError(
                f"features[{index}].id is not its deterministic report ID"
            )
        if not isinstance(geometry, dict) or geometry.get("type") != "Point":
            raise OutputValidationError(f"features[{index}].geometry must be a Point")
        coordinates = geometry.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) != 2:
            raise OutputValidationError(
                f"features[{index}].coordinates must contain longitude, latitude"
            )
        longitude = _require_finite_coordinate(
            coordinates[0],
            f"features[{index}].longitude",
        )
        latitude = _require_finite_coordinate(
            coordinates[1],
            f"features[{index}].latitude",
        )
        if not -180.0 <= longitude <= 180.0:
            raise OutputValidationError(
                f"features[{index}].longitude is outside its valid range"
            )
        if not -90.0 <= latitude <= 90.0:
            raise OutputValidationError(
                f"features[{index}].latitude is outside its valid range"
            )
        if (
            properties.get("longitude") != coordinates[0]
            or properties.get("latitude") != coordinates[1]
        ):
            raise OutputValidationError(
                f"features[{index}] coordinate properties do not match geometry"
            )

    if feature_report_ids != event_report_ids:
        raise OutputValidationError(
            "event reports and GeoJSON features identify different reports"
        )
    if len(event_report_ids) != expected_report_count:
        raise OutputValidationError(
            "correlated event report count must equal accepted report count"
        )

    serialize_document(event_document)
    serialize_document(geojson_document)


def serialize_document(document: object) -> bytes:
    """Serialize deterministic strict UTF-8 JSON with a trailing newline."""

    return (
        json.dumps(
            document,
            allow_nan=False,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n"
    ).encode("utf-8")


def _write_durable(path: Path, payload: bytes) -> None:
    """Create one file, flush it, and synchronize its contents to disk."""

    with path.open("xb") as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())


def _unlink(path: Path) -> None:
    """Remove a transaction file if it exists."""

    try:
        path.unlink()
    except FileNotFoundError:
        pass


def cleanup_stale_temporary_files(output_dir: Path) -> None:
    """Remove abandoned X staging files without touching recovery backups."""

    for path in output_dir.glob(".x_report_*.tmp"):
        _unlink(path)


def _rollback(
    *,
    destinations: tuple[Path, Path],
    backups: tuple[Path, Path],
    prior_bytes: tuple[bytes | None, bytes | None],
    replace: ReplaceFunction,
) -> None:
    """Restore both prior destinations or raise a critical rollback error."""

    errors: list[str] = []
    for destination, backup, previous in zip(
        destinations,
        backups,
        prior_bytes,
        strict=True,
    ):
        try:
            if previous is None:
                _unlink(destination)
            else:
                replace(backup, destination)
        except OSError as error:
            errors.append(f"{destination.name}: {error}")
    for destination, previous in zip(destinations, prior_bytes, strict=True):
        try:
            current = destination.read_bytes() if destination.exists() else None
            if current != previous:
                errors.append(f"{destination.name}: restored bytes do not match")
        except OSError as error:
            errors.append(f"{destination.name}: verification failed: {error}")
    if errors:
        raise OutputRollbackError(
            "CRITICAL: X output rollback failed; recovery backups were retained: "
            + "; ".join(errors)
        )


def publish_output_pair(
    output_dir: Path,
    event_document: dict[str, Any],
    geojson_document: dict[str, Any],
    *,
    expected_report_count: int,
    replace: ReplaceFunction = os.replace,
    serializer: SerializerFunction = serialize_document,
) -> None:
    """Publish the validated pair with coordinated backup and rollback."""

    validate_output_pair(
        event_document,
        geojson_document,
        expected_report_count=expected_report_count,
    )
    event_payload = serializer(event_document)
    geojson_payload = serializer(geojson_document)
    generation_id = str(event_document["generation_id"])

    output_dir.mkdir(parents=True, exist_ok=True)
    cleanup_stale_temporary_files(output_dir)
    destinations = (
        output_dir / EVENT_FILENAME,
        output_dir / GEOJSON_FILENAME,
    )
    temporary = (
        output_dir / f".x_report_events.{generation_id}.tmp",
        output_dir / f".x_report_pinpoints.{generation_id}.tmp",
    )
    backups = (
        output_dir / f".x_report_events.{generation_id}.bak",
        output_dir / f".x_report_pinpoints.{generation_id}.bak",
    )
    prior_bytes: tuple[bytes | None, bytes | None] = (
        destinations[0].read_bytes() if destinations[0].exists() else None,
        destinations[1].read_bytes() if destinations[1].exists() else None,
    )

    try:
        _write_durable(temporary[0], event_payload)
        _write_durable(temporary[1], geojson_payload)
        for backup, previous in zip(backups, prior_bytes, strict=True):
            if previous is not None:
                _write_durable(backup, previous)
    except OSError as error:
        for path in (*temporary, *backups):
            _unlink(path)
        raise OutputStagingError(
            f"failed to stage complete X output generation: {error}"
        ) from error

    publication_started = False
    try:
        publication_started = True
        replace(temporary[0], destinations[0])
        replace(temporary[1], destinations[1])
        installed_events = json.loads(destinations[0].read_text(encoding="utf-8"))
        installed_geojson = json.loads(destinations[1].read_text(encoding="utf-8"))
        validate_output_pair(
            installed_events,
            installed_geojson,
            expected_report_count=expected_report_count,
        )
        if (
            destinations[0].read_bytes() != event_payload
            or destinations[1].read_bytes() != geojson_payload
        ):
            raise OutputValidationError(
                "installed X output bytes differ from staged generation"
            )
    except (OSError, ValueError, json.JSONDecodeError) as error:
        if publication_started:
            try:
                _rollback(
                    destinations=destinations,
                    backups=backups,
                    prior_bytes=prior_bytes,
                    replace=replace,
                )
            except OutputRollbackError:
                for path in temporary:
                    _unlink(path)
                raise
        raise OutputPublicationError(
            f"X output publication failed; rollback succeeded: {error}"
        ) from error
    finally:
        for path in temporary:
            _unlink(path)

    for path in backups:
        _unlink(path)
    LOGGER.info(
        "[X REPORTS] Transactionally published generation %s using "
        "coordinated backup-and-replace",
        generation_id,
    )

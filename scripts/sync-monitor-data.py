#!/usr/bin/env python3
"""Validate and atomically publish monitor data into the website data directory."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable


Validator = Callable[[object, str], None]


@dataclass(frozen=True)
class SyncResult:
    name: str
    status: str
    size: int = 0
    detail: str = ""


def read_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def require_mapping(value: object, label: str) -> dict:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object")
    return value


def require_nonempty_list(value: object, label: str) -> list:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{label} must contain a non-empty JSON array")
    return value


def validate_ai_digest(value: object, label: str) -> None:
    digest = require_mapping(value, label)
    stories = require_nonempty_list(digest.get("stories"), f"{label}.stories")
    if not (digest.get("generated_at") or digest.get("generated")):
        raise ValueError(f"{label} is missing generated_at")
    for index, story in enumerate(stories):
        item = require_mapping(story, f"{label}.stories[{index}]")
        if not str(item.get("title") or "").strip():
            raise ValueError(f"{label}.stories[{index}] is missing title")
        if not str(item.get("source") or "").strip():
            raise ValueError(f"{label}.stories[{index}] is missing source")
        if not str(item.get("source_url") or item.get("link") or "").strip():
            raise ValueError(f"{label}.stories[{index}] is missing source URL")


def validate_disaster_state(value: object, label: str) -> None:
    state = require_mapping(value, label)
    require_nonempty_list(state.get("events"), f"{label}.events")


def validate_event_array(value: object, label: str) -> None:
    require_nonempty_list(value, label)


def validate_ews_state(value: object, label: str) -> None:
    state = require_mapping(value, label)
    required = {"level", "concurrent_count", "z_score", "last_checked", "as_of"}
    missing = sorted(required.difference(state))
    if missing:
        raise ValueError(f"{label} is missing: {', '.join(missing)}")
    if not isinstance(state["level"], int) or not 0 <= state["level"] <= 4:
        raise ValueError(f"{label}.level must be an integer from 0 through 4")
    if not isinstance(state["concurrent_count"], int) or state["concurrent_count"] < 0:
        raise ValueError(f"{label}.concurrent_count must be a non-negative integer")
    if not isinstance(state["z_score"], (int, float)):
        raise ValueError(f"{label}.z_score must be numeric")
    for field in ("last_checked", "as_of"):
        if parse_generated(state[field]) is None:
            raise ValueError(f"{label}.{field} must be an ISO 8601 timestamp")


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def atomic_replace(destination: Path, payload: bytes) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.name}.",
        suffix=".tmp",
        dir=destination.parent,
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def publish_file(
    source: Path,
    destination: Path,
    validator: Validator,
    name: str | None = None,
) -> SyncResult:
    label = name or destination.name
    if not source.is_file():
        return SyncResult(label, "skipped", detail=f"source unavailable: {source}")
    try:
        payload = source.read_bytes()
        value = json.loads(payload.decode("utf-8"))
        validator(value, label)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return SyncResult(label, "failed", detail=str(error))

    if destination.is_file() and destination.read_bytes() == payload:
        return SyncResult(label, "unchanged", len(payload))

    atomic_replace(destination, payload)
    return SyncResult(label, "updated", len(payload))


def validate_sentinel_publication(source_root: Path) -> tuple[dict, dict[str, bytes]]:
    manifest_path = source_root / "manifest.json"
    manifest_payload = manifest_path.read_bytes()
    manifest = require_mapping(
        json.loads(manifest_payload.decode("utf-8")), "manifest.json"
    )
    if str(manifest.get("schema_version", "")).split(".", 1)[0] != "1":
        raise ValueError("manifest.json has an unsupported schema version")
    if not manifest.get("publication_id"):
        raise ValueError("manifest.json is missing publication_id")
    files = require_mapping(manifest.get("files"), "manifest.json.files")

    expected = {
        "dashboard.json",
        "intelligence_brief.json",
        "map_events.json",
        "timeline.json",
        "trends.json",
        "world_events.json",
        "health.json",
    }
    missing = sorted(expected.difference(files))
    if missing:
        raise ValueError(f"manifest.json is missing files: {', '.join(missing)}")

    payloads: dict[str, bytes] = {"manifest.json": manifest_payload}
    for filename in sorted(expected):
        metadata = require_mapping(files[filename], f"manifest.json.files.{filename}")
        path = source_root / filename
        payload = path.read_bytes()
        json.loads(payload.decode("utf-8"))
        if len(payload) != metadata.get("bytes"):
            raise ValueError(f"{filename} size does not match the manifest")
        if sha256(payload) != metadata.get("sha256"):
            raise ValueError(f"{filename} checksum does not match the manifest")
        payloads[filename] = payload

    require_mapping(json.loads(payloads["dashboard.json"]), "dashboard.json")
    require_mapping(
        json.loads(payloads["intelligence_brief.json"]), "intelligence_brief.json"
    )
    require_nonempty_list(json.loads(payloads["map_events.json"]), "map_events.json")
    require_nonempty_list(json.loads(payloads["timeline.json"]), "timeline.json")
    require_mapping(json.loads(payloads["trends.json"]), "trends.json")
    require_mapping(json.loads(payloads["health.json"]), "health.json")
    world = require_mapping(json.loads(payloads["world_events.json"]), "world_events.json")
    require_nonempty_list(world.get("events"), "world_events.json.events")
    return manifest, payloads


def publish_sentinel(source_root: Path, destination_root: Path) -> list[SyncResult]:
    filenames = [
        "dashboard.json",
        "intelligence_brief.json",
        "map_events.json",
        "timeline.json",
        "trends.json",
        "world_events.json",
        "health.json",
        "manifest.json",
    ]
    if not source_root.is_dir():
        return [
            SyncResult(filename, "skipped", detail="Sentinel source unavailable")
            for filename in filenames
        ]
    try:
        _manifest, payloads = validate_sentinel_publication(source_root)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        return [
            SyncResult(filename, "failed", detail=f"publication rejected: {error}")
            for filename in filenames
        ]

    results: list[SyncResult] = []
    for filename in filenames:
        payload = payloads[filename]
        destination = destination_root / filename
        if destination.is_file() and destination.read_bytes() == payload:
            results.append(SyncResult(filename, "unchanged", len(payload)))
            continue
        atomic_replace(destination, payload)
        results.append(SyncResult(filename, "updated", len(payload)))
    return results


def parse_generated(value: object) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def freshness_warning(path: Path, maximum_age_hours: int) -> str | None:
    if not path.is_file():
        return None
    try:
        value = require_mapping(read_json(path), path.name)
    except (OSError, json.JSONDecodeError, ValueError):
        return None
    generated = parse_generated(
        value.get("generated_at") or value.get("generated") or value.get("last_updated")
    )
    if not generated:
        return f"{path.name} has no parseable generation timestamp"
    age_hours = (datetime.now(timezone.utc) - generated).total_seconds() / 3600
    if age_hours > maximum_age_hours:
        return f"{path.name} is {age_hours:.1f} hours old"
    return None


def write_summary(results: list[SyncResult], warnings: list[str]) -> None:
    headings = ("updated", "unchanged", "skipped", "failed")
    lines = ["## Monitor data sync", "", "| Result | Files |", "|---|---|"]
    for status in headings:
        names = [result.name for result in results if result.status == status]
        lines.append(f"| {status.title()} | {', '.join(names) if names else 'None'} |")
    lines.extend(["", "### Output sizes", ""])
    for result in results:
        if result.size:
            lines.append(f"- `{result.name}`: {result.size:,} bytes")
    if warnings:
        lines.extend(["", "### Warnings", ""])
        lines.extend(f"- {warning}" for warning in warnings)

    summary = "\n".join(lines) + "\n"
    print(summary)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with Path(summary_path).open("a", encoding="utf-8") as stream:
            stream.write(summary)


def sync_all(repository: Path) -> list[SyncResult]:
    data = repository / "data"
    external = repository / "external"
    results = [
        publish_file(
            external / "disaster" / "data" / "disaster_state.json",
            data / "disaster_state.json",
            validate_disaster_state,
        ),
    ]
    for filename in ("earthquakes.json", "volcanoes.json", "weather.json", "solar.json"):
        results.append(
            publish_file(
                external / "disaster" / "data" / filename,
                data / filename,
                validate_event_array,
            )
        )
    results.extend(
        publish_sentinel(external / "sentinel" / "data" / "output", data)
    )
    warnings = [
        warning
        for warning in (
            freshness_warning(data / "ai_cyber_digest.json", 36),
            freshness_warning(data / "disaster_state.json", 24),
            freshness_warning(data / "manifest.json", 24),
        )
        if warning
    ]
    for result in results:
        detail = f" - {result.detail}" if result.detail else ""
        print(f"{result.status.upper()}: {result.name} ({result.size:,} bytes){detail}")
    write_summary(results, warnings)
    return results


def sync_ai(repository: Path) -> SyncResult:
    result = publish_file(
        repository / "external" / "ai" / "data" / "ai_cyber_digest.json",
        repository / "data" / "ai_cyber_digest.json",
        validate_ai_digest,
    )
    detail = f" - {result.detail}" if result.detail else ""
    print(f"{result.status.upper()}: {result.name} ({result.size:,} bytes){detail}")
    warnings = [
        warning
        for warning in (
            freshness_warning(repository / "data" / "ai_cyber_digest.json", 36),
        )
        if warning
    ]
    write_summary([result], warnings)
    return result


def sync_ews(repository: Path) -> SyncResult:
    result = publish_file(
        repository / "external" / "ews" / "state.json",
        repository / "data" / "ews_state.json",
        validate_ews_state,
    )
    detail = f" - {result.detail}" if result.detail else ""
    print(f"{result.status.upper()}: {result.name} ({result.size:,} bytes){detail}")
    write_summary([result], [])
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--repository",
        type=Path,
        default=Path.cwd(),
        help="Website repository root",
    )
    parser.add_argument(
        "--ai-only",
        action="store_true",
        help="Synchronize only the completed AI Cyber Daily Digest",
    )
    parser.add_argument(
        "--ews-only",
        action="store_true",
        help="Synchronize only the Early Warning System state",
    )
    arguments = parser.parse_args()
    repository = arguments.repository.resolve()
    if arguments.ai_only:
        sync_ai(repository)
    elif arguments.ews_only:
        sync_ews(repository)
    else:
        sync_all(repository)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

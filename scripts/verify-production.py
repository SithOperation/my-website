#!/usr/bin/env python3
"""Verify that production serves one expected Sentinel publication."""

from __future__ import annotations

import argparse
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

SUPPORTED_EVENT_TYPES = frozenset(
    {
        "conflict",
        "earthquake",
        "flood",
        "humanitarian",
        "natural_hazard",
        "reddit_report",
        "tropical_cyclone",
        "volcano",
        "weather_alert",
        "wildfire",
        "x_report",
    }
)


class ProductionVerificationError(RuntimeError):
    """Raised when production does not serve the expected publication."""


@dataclass(frozen=True)
class VerificationResult:
    publication_id: str
    generated: str
    map_event_count: int
    health_status: str
    source_feed_count: int
    source_feed_status: str


JsonFetcher = Callable[[str], object]
RawFetcher = Callable[[str], bytes]


def fetch_json(url: str) -> object:
    """Fetch one cache-busted JSON resource with bounded network time."""
    separator = "&" if "?" in url else "?"
    cache_busted = f"{url}{separator}audit={time.time_ns()}"
    request = urllib.request.Request(
        cache_busted,
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "Sentinel-Production-Verifier/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise ProductionVerificationError(f"{url} returned HTTP {response.status}")
        return json.loads(response.read().decode("utf-8"))


def fetch_bytes(url: str) -> bytes:
    """Fetch one cache-busted resource exactly as production serves it."""
    separator = "&" if "?" in url else "?"
    cache_busted = f"{url}{separator}audit={time.time_ns()}"
    request = urllib.request.Request(
        cache_busted,
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "Sentinel-Production-Verifier/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise ProductionVerificationError(f"{url} returned HTTP {response.status}")
        return bytes(response.read())


def require_mapping(value: object, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProductionVerificationError(f"{label} must be a JSON object")
    return value


def validate_map_events(value: object, minimum_count: int) -> list[dict[str, Any]]:
    """Validate production map events and their geographic contract."""
    if not isinstance(value, list) or len(value) < minimum_count:
        actual = len(value) if isinstance(value, list) else 0
        raise ProductionVerificationError(
            f"map_events.json has {actual} events; expected at least {minimum_count}"
        )
    events: list[dict[str, Any]] = []
    for index, value_event in enumerate(value):
        event = require_mapping(value_event, f"map_events[{index}]")
        latitude = event.get("latitude")
        longitude = event.get("longitude")
        event_type = event.get("type")
        if (
            not isinstance(latitude, (int, float))
            or isinstance(latitude, bool)
            or not -90 <= latitude <= 90
        ):
            raise ProductionVerificationError(
                f"map_events[{index}] has invalid latitude"
            )
        if (
            not isinstance(longitude, (int, float))
            or isinstance(longitude, bool)
            or not -180 <= longitude <= 180
        ):
            raise ProductionVerificationError(
                f"map_events[{index}] has invalid longitude"
            )
        if latitude == 0 and longitude == 0:
            raise ProductionVerificationError(
                f"map_events[{index}] uses placeholder coordinates"
            )
        if event_type not in SUPPORTED_EVENT_TYPES:
            raise ProductionVerificationError(
                f"map_events[{index}] has unsupported type {event_type!r}"
            )
        if not event.get("event_id") or not event.get("timestamp"):
            raise ProductionVerificationError(
                f"map_events[{index}] lacks an event ID or timestamp"
            )
        events.append(event)
    return events


def verify_production(
    base_url: str,
    expected_publication_id: str,
    minimum_count: int = 1,
    fetcher: JsonFetcher = fetch_json,
    raw_fetcher: RawFetcher | None = None,
) -> VerificationResult:
    """Verify manifest, map, and health documents for one publication."""
    root = base_url.rstrip("/")
    manifest = require_mapping(fetcher(f"{root}/manifest.json"), "manifest.json")
    actual_publication_id = str(manifest.get("publication_id") or "")
    if actual_publication_id != expected_publication_id:
        raise ProductionVerificationError(
            f"production publication {actual_publication_id!r} does not match "
            f"{expected_publication_id!r}"
        )
    generated = str(manifest.get("generated") or "")
    if not generated:
        raise ProductionVerificationError("manifest.json is missing generated")
    events = validate_map_events(
        fetcher(f"{root}/map_events.json"),
        minimum_count,
    )
    health = require_mapping(fetcher(f"{root}/health.json"), "health.json")
    health_generated = str(health.get("generated") or "")
    if health_generated and health_generated != generated:
        raise ProductionVerificationError(
            "health.json and manifest.json generation timestamps differ"
        )
    manifest_files = require_mapping(manifest.get("files"), "manifest.json.files")
    source_metadata = require_mapping(
        manifest_files.get("source_feed.json"),
        "manifest.json.files.source_feed.json",
    )
    if (
        not isinstance(source_metadata.get("bytes"), int)
        or source_metadata["bytes"] < 1
        or not isinstance(source_metadata.get("sha256"), str)
        or len(source_metadata["sha256"]) != 64
    ):
        raise ProductionVerificationError(
            "manifest source_feed.json metadata is invalid"
        )
    if raw_fetcher is None and fetcher is fetch_json:
        raw_fetcher = fetch_bytes
    if raw_fetcher is not None:
        source_payload = raw_fetcher(f"{root}/source_feed.json")
        if len(source_payload) != source_metadata["bytes"]:
            raise ProductionVerificationError(
                "production source_feed.json size does not match the manifest"
            )
        if hashlib.sha256(source_payload).hexdigest() != source_metadata["sha256"]:
            raise ProductionVerificationError(
                "production source_feed.json checksum does not match the manifest"
            )
    source_feed = require_mapping(
        fetcher(f"{root}/source_feed.json"), "source_feed.json"
    )
    if source_feed.get("publication_id") != actual_publication_id:
        raise ProductionVerificationError(
            "source_feed.json publication ID does not match the manifest"
        )
    if source_feed.get("generated_at") != generated:
        raise ProductionVerificationError(
            "source_feed.json and manifest.json generation timestamps differ"
        )
    source_items = source_feed.get("items")
    if (
        source_feed.get("schema_version") != "1.0"
        or not isinstance(source_items, list)
        or source_feed.get("count") != len(source_items)
    ):
        raise ProductionVerificationError("source_feed.json contract is invalid")
    source_health = require_mapping(
        source_feed.get("health"), "source_feed.json.health"
    )
    if source_health.get("status") not in {
        "fresh",
        "stale",
        "partial",
        "unavailable",
    }:
        raise ProductionVerificationError("source_feed.json health is invalid")
    return VerificationResult(
        publication_id=actual_publication_id,
        generated=generated,
        map_event_count=len(events),
        health_status=str(health.get("status") or "unknown"),
        source_feed_count=len(source_items),
        source_feed_status=str(source_health["status"]),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify the Sentinel publication served by production."
    )
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--publication-id", required=True)
    parser.add_argument("--minimum-map-events", type=int, default=1)
    parser.add_argument("--attempts", type=int, default=12)
    parser.add_argument("--retry-delay-seconds", type=float, default=5)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.minimum_map_events < 1 or args.attempts < 1:
        print("Production verification failed: count and attempts must be positive")
        return 1
    for attempt in range(1, args.attempts + 1):
        try:
            result = verify_production(
                args.base_url,
                args.publication_id,
                args.minimum_map_events,
            )
        except (
            json.JSONDecodeError,
            OSError,
            UnicodeError,
            urllib.error.URLError,
            ProductionVerificationError,
        ) as error:
            if attempt == args.attempts:
                print(f"Production verification failed: {error}")
                return 1
            print(
                f"Production verification attempt {attempt}/{args.attempts} "
                f"failed: {error}"
            )
            time.sleep(args.retry_delay_seconds)
            continue
        print(
            "Production verified: "
            f"publication={result.publication_id} "
            f"generated={result.generated} "
            f"map_events={result.map_event_count} "
            f"health={result.health_status}"
            f" source_feed={result.source_feed_count}"
            f" source_feed_health={result.source_feed_status}"
        )
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

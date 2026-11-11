"""Deterministic tests for the free Sentinel source collector."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.error import HTTPError

import pytest

from collectors.sentinel_sources import (
    FetchedDocument,
    SourceCollectionError,
    SourceSpec,
    classify_categories,
    classify_countries,
    deduplicate_items,
    fetch_document,
    load_registry,
    parse_document,
    parse_timestamp,
    valid_coordinates,
)

ROOT = Path(__file__).parents[1]


def source(source_type: str = "rss") -> SourceSpec:
    return SourceSpec(
        id="fixture-source",
        publisher="Fixture Publisher",
        endpoint="https://example.test/feed",
        source_type=source_type,
        categories=("news",),
        language="en",
        polling_interval_minutes=30,
        authentication="none",
        country_or_region="Global",
        official_website="https://example.test/",
        usage_restrictions="headlines and links only",
        reliability="fixture",
        enabled=True,
    )


class Response:
    status = 200

    def __init__(self, body: bytes, headers: dict[str, str] | None = None) -> None:
        self._body = body
        self.headers = headers or {}

    def __enter__(self) -> "Response":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return self._body


def test_registry_has_unique_verified_structured_sources() -> None:
    sources = load_registry(ROOT / "config" / "sentinel_sources.json")
    assert len(sources) >= 5
    assert len({item.id for item in sources}) == len(sources)
    assert all(item.endpoint.startswith("https://") for item in sources)


def test_registry_rejects_unverified_enabled_source(tmp_path: Path) -> None:
    registry: dict[str, Any] = {
        "schema_version": "1.0",
        "sources": [{
            "id": "unverified-source",
            "publisher": "Fixture",
            "country_or_region": "Global",
            "official_website": "https://example.test",
            "endpoint": "https://example.test/feed",
            "source_type": "rss",
            "categories": ["news"],
            "language": "en",
            "polling_interval_minutes": 30,
            "authentication": "none",
            "usage_restrictions": "fixture",
            "reliability": "fixture",
            "enabled": True,
            "endpoint_verified_at": None,
            "last_successful_fetch": None,
            "last_error": None,
        }],
    }
    path = tmp_path / "sources.json"
    path.write_text(json.dumps(registry), encoding="utf-8")
    with pytest.raises(SourceCollectionError, match="cannot be enabled"):
        load_registry(path)


def test_rss_parser_keeps_headline_link_and_does_not_invent_location() -> None:
    body = b"""<?xml version='1.0'?><rss><channel><item>
      <title>Japan reports a new regional security update</title>
      <link>https://example.test/story/1</link>
      <description><![CDATA[<p>Short source summary.</p>]]></description>
      <pubDate>Tue, 11 Nov 2026 12:00:00 GMT</pubDate>
    </item></channel></rss>"""
    items = parse_document(source(), body, "2026-11-11T12:01:00Z")
    assert len(items) == 1
    assert items[0]["countries"] == ["Japan"]
    assert items[0]["latitude"] is None
    assert items[0]["longitude"] is None
    assert items[0]["url"] == "https://example.test/story/1"


def test_geojson_parser_preserves_only_source_coordinates() -> None:
    body = json.dumps({
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [139.7, 35.6]},
            "properties": {
                "title": "Observed event",
                "url": "https://example.test/event",
                "time": "2026-11-11T12:00:00Z",
            },
        }, {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [0, 0]},
            "properties": {"title": "Unlocated event"},
        }],
    }).encode()
    items = parse_document(source("geojson"), body, "2026-11-11T12:01:00Z")
    assert len(items) == 2
    assert items[0]["latitude"] == 35.6
    assert items[0]["longitude"] == 139.7
    assert items[1]["latitude"] is None
    assert items[1]["geolocation_confidence"] is None


def test_timestamp_and_classifiers_are_conservative() -> None:
    assert parse_timestamp("Tue, 11 Nov 2026 12:00:00 GMT") == "2026-11-11T12:00:00Z"
    assert parse_timestamp("2026-11-11T12:00:00-05:00") == "2026-11-11T17:00:00Z"
    assert parse_timestamp("not a timestamp") is None
    assert set(classify_countries("Polish officials met German and Japanese counterparts")) == {"Poland", "Germany", "Japan"}
    assert "conflict" in classify_categories("Missile strike reported", ("news",))


def test_duplicate_items_are_removed_by_stable_identity() -> None:
    item = {"id": "a", "url": "https://example.test/a", "publisher": "Fixture", "title": "Same headline"}
    duplicate = {**item, "id": "b"}
    assert len(deduplicate_items([item, duplicate])) == 1


def test_fetch_uses_conditional_headers_and_retries_rate_limits() -> None:
    calls: list[dict[str, str]] = []
    sleeps: list[float] = []

    class RetryResponse(Response):
        pass

    def opener(request: Any, timeout: int) -> Response:
        calls.append(dict(request.header_items()))
        if len(calls) == 1:
            raise HTTPError(request.full_url, 429, "rate limited", {"Retry-After": "0"}, None)
        return RetryResponse(b"<rss/>", {"ETag": "next"})

    document, state = fetch_document(
        source(),
        {"etag": "old", "last_modified": "yesterday"},
        opener=opener,
        sleep=sleeps.append,
        retries=1,
    )
    assert document is not None
    assert state["etag"] == "next"
    assert calls[0]["If-none-match"] == "old"
    assert calls[0]["If-modified-since"] == "yesterday"
    assert sleeps == [0.0]


def test_coordinate_validation_rejects_null_island() -> None:
    assert valid_coordinates(54.6872, 25.2797)
    assert not valid_coordinates(0, 0)
    assert not valid_coordinates(91, 25)

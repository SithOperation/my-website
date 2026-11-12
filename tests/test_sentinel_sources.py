"""Deterministic tests for the free Sentinel source collector."""

from __future__ import annotations

import json
from email.message import Message
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
from collectors.sentinel_verification import classify_text, load_keyword_rules, verify_items

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


def test_gdelt_json_article_shape_is_supported() -> None:
    body = json.dumps({
        "articles": [{
            "title": "Lithuania publishes a security update",
            "url": "https://example.test/gdelt-story",
            "seendate": "20261111120000",
            "domain": "example.test",
        }]
    }).encode()
    items = parse_document(source("json"), body, "2026-11-11T12:01:00Z")
    assert items[0]["published_at"] == "2026-11-11T12:00:00Z"
    assert items[0]["countries"] == ["Lithuania"]


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
            headers = Message()
            headers["Retry-After"] = "0"
            raise HTTPError(request.full_url, 429, "rate limited", headers, None)
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


def test_keyword_engine_requires_context_and_rejects_false_positive_phrases() -> None:
    dictionary = json.loads((ROOT / "config" / "sentinel_keywords.json").read_text(encoding="utf-8"))
    rules = load_keyword_rules(ROOT / "config" / "sentinel_keywords.json")
    multilingual = dictionary["multilingual"]
    assert classify_text("Missile defense exercise announced", "Training begins next week.", rules, multilingual) == []
    assert classify_text("Nuclear negotiations continue", "Officials discussed a treaty.", rules, multilingual) == []
    detected = classify_text("Missile launch reported", "Authorities said a missile was fired toward the coast.", rules, multilingual)
    assert {item["category"] for item in detected} >= {"missile_activity"}
    assert any("missile launch" in item["detected_keywords"] for item in detected)


def test_keyword_engine_supports_native_language_terms() -> None:
    dictionary = json.loads((ROOT / "config" / "sentinel_keywords.json").read_text(encoding="utf-8"))
    rules = load_keyword_rules(ROOT / "config" / "sentinel_keywords.json")
    detected = classify_text("Землетрясение магнитудой 5.2", "После толчков объявлено предупреждение.", rules, dictionary["multilingual"])
    assert any(item["category"] == "earthquakes" for item in detected)


def test_verification_counts_independent_sources_and_preserves_wire_grouping() -> None:
    items = [
        {
            "id": "one", "title": "Missile launch reported near coast", "summary": "Authorities said a missile was fired.",
            "url": "https://alpha.example/story", "publisher": "Alpha", "source_id": "alpha", "independence_group": "alpha",
            "categories": ["missile_activity"], "countries": ["Japan"], "published_at": "2026-11-11T12:00:00Z",
        },
        {
            "id": "two", "title": "Missile launch reported near coast", "summary": "Authorities said a missile was fired.",
            "url": "https://beta.example/story", "publisher": "Beta", "source_id": "beta", "independence_group": "beta",
            "categories": ["missile_activity"], "countries": ["Japan"], "published_at": "2026-11-11T12:30:00Z",
        },
        {
            "id": "wire", "title": "Missile launch reported near coast", "summary": "Wire copy.",
            "url": "https://wire.example/story", "publisher": "Wire", "source_id": "wire-copy", "independence_group": "shared-wire",
            "categories": ["missile_activity"], "countries": ["Japan"], "published_at": "2026-11-11T12:35:00Z",
        },
    ]
    verified = verify_items(items, checked_at="2026-11-11T13:00:00Z")
    assert all(item["verification"]["status"] == "corroborated" for item in verified)
    assert all(item["verification"]["independent_source_count"] == 3 for item in verified)
    assert all(0 <= item["verification"]["confidence_score"] <= 100 for item in verified)


def test_verification_separates_severity_from_confidence_and_marks_retraction() -> None:
    item = {
        "id": "retracted", "title": "Ransomware attack report retracted", "summary": "The publisher withdrew the claim.",
        "url": "https://example.test/retracted", "publisher": "Fixture", "source_id": "fixture",
        "categories": ["cybersecurity"], "countries": [], "published_at": "2026-11-11T12:00:00Z", "severity": "CRITICAL",
    }
    result = verify_items([item], checked_at="2026-11-11T13:00:00Z")[0]
    assert result["verification"]["status"] == "retracted"
    assert result["severity"] == "CRITICAL"
    assert result["verification"]["confidence_score"] < 100
    assert result["information_type"] == "unverified_report"
    assert result["lifecycle"] == "resolved"
    assert result["geographic_relevance"]["confidence"] == "none"


def test_verification_exposes_separate_information_and_geography_fields() -> None:
    item = {
        "id": "quake", "title": "Earthquake strikes Japan", "summary": "A magnitude 5 event was observed.",
        "url": "https://example.test/quake", "publisher": "USGS", "source_id": "usgs",
        "official_source": True, "categories": ["earthquake"], "countries": ["Japan"],
        "published_at": "2026-11-11T12:00:00Z", "latitude": 35.6, "longitude": 139.7,
    }
    result = verify_items([item], checked_at="2026-11-11T13:00:00Z")[0]
    assert result["information_type"] == "official_advisory"
    assert result["subject_category"] == "natural_disaster"
    assert result["geographic_relevance"]["mentioned"] == ["Japan"]
    assert result["geographic_relevance"]["incident"] == []


def test_war_reports_have_a_medium_floor_and_active_attacks_are_high() -> None:
    low_war = {
        "id": "war-news", "title": "War negotiations continue", "summary": "Officials discussed the conflict.",
        "url": "https://example.test/war", "publisher": "Fixture", "source_id": "fixture",
        "categories": ["conflict"], "countries": ["Ukraine"], "published_at": "2026-11-11T12:00:00Z",
        "severity": "LOW",
    }
    high_war = {**low_war, "id": "war-attack", "title": "Missile strike kills civilians", "severity": "LOW"}
    results = verify_items([low_war, high_war], checked_at="2026-11-11T13:00:00Z")
    assert results[0]["severity"] == "MEDIUM"
    assert results[1]["severity"] == "HIGH"

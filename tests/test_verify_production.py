import importlib.util
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast

import pytest

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "verify-production.py"
SPEC = importlib.util.spec_from_file_location("verify_production", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load production verifier: {MODULE_PATH}")
verify_production = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = verify_production
SPEC.loader.exec_module(verify_production)


def production_documents() -> dict[str, object]:
    return {
        "manifest.json": {
            "publication_id": "expected",
            "generated": "2026-07-28T05:09:57+00:00",
            "files": {
                "source_feed.json": {
                    "bytes": 100,
                    "sha256": "a" * 64,
                }
            },
        },
        "map_events.json": [
            {
                "event_id": "SG-1",
                "type": "earthquake",
                "latitude": 34.5,
                "longitude": -117.2,
                "timestamp": "2026-07-28T05:00:00+00:00",
            }
        ],
        "health.json": {
            "generated": "2026-07-28T05:09:57+00:00",
            "status": "degraded",
        },
        "source_feed.json": {
            "schema_version": "1.0",
            "publication_id": "expected",
            "generated_at": "2026-07-28T05:09:57+00:00",
            "count": 0,
            "health": {"status": "unavailable", "sources": []},
            "items": [],
        },
    }


def make_fetcher(documents: dict[str, object]) -> Callable[[str], object]:
    def fetch(url: str) -> object:
        return documents[url.rsplit("/", 1)[-1]]

    return fetch


def test_valid_production_publication() -> None:
    result = verify_production.verify_production(
        "https://example.test/data",
        "expected",
        fetcher=make_fetcher(production_documents()),
    )

    assert result.publication_id == "expected"
    assert result.map_event_count == 1
    assert result.health_status == "degraded"
    assert result.source_feed_count == 0
    assert result.source_feed_status == "unavailable"


def test_reddit_report_map_event_is_supported() -> None:
    documents = production_documents()
    events = cast(list[dict[str, Any]], documents["map_events.json"])
    events[0]["type"] = "reddit_report"

    result = verify_production.verify_production(
        "https://example.test/data",
        "expected",
        fetcher=make_fetcher(documents),
    )

    assert result.map_event_count == 1


def test_mixed_source_feed_is_rejected() -> None:
    documents = production_documents()
    cast(dict[str, Any], documents["source_feed.json"])["publication_id"] = "different"
    with pytest.raises(
        verify_production.ProductionVerificationError,
        match="publication ID",
    ):
        verify_production.verify_production(
            "https://example.test/data",
            "expected",
            fetcher=make_fetcher(documents),
        )


def test_source_feed_checksum_mismatch_is_rejected() -> None:
    with pytest.raises(
        verify_production.ProductionVerificationError,
        match="size does not match",
    ):
        verify_production.verify_production(
            "https://example.test/data",
            "expected",
            fetcher=make_fetcher(production_documents()),
            raw_fetcher=lambda _url: b"wrong",
        )


def test_publication_mismatch_is_rejected() -> None:
    with pytest.raises(
        verify_production.ProductionVerificationError,
        match="does not match",
    ):
        verify_production.verify_production(
            "https://example.test/data",
            "different",
            fetcher=make_fetcher(production_documents()),
        )


def test_empty_map_is_rejected() -> None:
    documents = production_documents()
    documents["map_events.json"] = []

    with pytest.raises(
        verify_production.ProductionVerificationError,
        match="expected at least",
    ):
        verify_production.verify_production(
            "https://example.test/data",
            "expected",
            fetcher=make_fetcher(documents),
        )


def test_invalid_coordinates_are_rejected() -> None:
    documents = production_documents()
    documents["map_events.json"] = [
        {
            "event_id": "SG-1",
            "type": "earthquake",
            "latitude": 0,
            "longitude": 0,
            "timestamp": "2026-07-28T05:00:00+00:00",
        }
    ]

    with pytest.raises(
        verify_production.ProductionVerificationError,
        match="placeholder coordinates",
    ):
        verify_production.verify_production(
            "https://example.test/data",
            "expected",
            fetcher=make_fetcher(documents),
        )

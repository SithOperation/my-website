import importlib.util
import sys
from collections.abc import Callable
from pathlib import Path

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

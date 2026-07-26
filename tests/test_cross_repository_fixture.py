"""Cross-repository contract and end-to-end fixture regression."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from main import build_x_report_layer
from models.x_report_contract import validate_document


def test_shared_fixture_reaches_geojson_one_for_one(tmp_path: Path) -> None:
    """The shared source contract survives validation through map output."""
    fixture = Path("tests/fixtures/x_sources_valid.json")
    document = json.loads(fixture.read_text(encoding="utf-8"))
    now = datetime(2026, 7, 26, 16, tzinfo=UTC)
    validate_document(document, now=now)
    source = tmp_path / "x_sources.json"
    source.write_text(json.dumps(document), encoding="utf-8")
    events, geojson = build_x_report_layer(
        source,
        tmp_path / "output",
        now=now,
        generation_id="cross-repository-fixture",
    )
    assert len(geojson["features"]) == len(document["reports"])
    assert sum(len(event["reports"]) for event in events) == len(
        document["reports"]
    )

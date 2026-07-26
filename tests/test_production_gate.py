"""Tests for the Pages production-readiness gate."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from scripts.production_gate import (
    ProductionGateError,
    validate_generated_x,
    validate_geojson,
)


def test_invalid_geojson_fails() -> None:
    """Malformed generated geography cannot deploy."""
    with pytest.raises(ProductionGateError, match="FeatureCollection"):
        validate_geojson({"type": "wrong", "features": []}, "fixture")


def test_schema_mismatch_fails(tmp_path: Path) -> None:
    """Cross-file schema drift is rejected before upload."""
    data = tmp_path / "data"
    output = data / "output"
    output.mkdir(parents=True)
    (data / "x_sources.json").write_text(
        '{"schema_version":"2.0","reports":[]}', encoding="utf-8"
    )
    (output / "x_report_events.json").write_text(
        '{"schema_version":"1.0","generation_id":"a","events":[]}',
        encoding="utf-8",
    )
    (output / "x_report_pinpoints.geojson").write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "schema_version": "1.0",
                "generation_id": "a",
                "features": [],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(ProductionGateError, match="schema version mismatch"):
        validate_generated_x(tmp_path)


def test_pages_deploy_requires_validation_job() -> None:
    """A failed validation job makes deployment unreachable."""
    workflow = yaml.safe_load(
        Path(".github/workflows/pages.yml").read_text(encoding="utf-8")
    )
    assert workflow["jobs"]["deploy"]["needs"] == "validate"

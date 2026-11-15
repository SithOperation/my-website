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
    validate_python_types,
    validate_workflows,
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


def test_workflow_validation_rejects_duplicate_keys(tmp_path: Path) -> None:
    """Duplicate workflow keys cannot be silently accepted by the release gate."""
    workflows = tmp_path / ".github" / "workflows"
    workflows.mkdir(parents=True)
    (workflows / "duplicate.yaml").write_text(
        "name: first\nname: second\njobs: {}\n",
        encoding="utf-8",
    )

    with pytest.raises(ProductionGateError, match="duplicate key"):
        validate_workflows(tmp_path)


def test_workflow_validation_accepts_yaml_extension(tmp_path: Path) -> None:
    """Both supported GitHub Actions workflow extensions are validated."""
    workflows = tmp_path / ".github" / "workflows"
    workflows.mkdir(parents=True)
    (workflows / "workflow.yaml").write_text(
        "name: test\non: workflow_dispatch\njobs: {}\n",
        encoding="utf-8",
    )

    validate_workflows(tmp_path)


def test_production_gate_uses_canonical_mypy_command(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """The production gate invokes the same configured command as CI."""
    invocation: dict[str, object] = {}

    class Result:
        """Minimal completed-process stand-in."""

        returncode = 0

    def run(
        command: list[str],
        *,
        cwd: Path,
        check: bool,
    ) -> Result:
        invocation.update(command=command, cwd=cwd, check=check)
        return Result()

    monkeypatch.setattr("scripts.production_gate.subprocess.run", run)

    validate_python_types(tmp_path)

    command = invocation["command"]
    assert isinstance(command, list)
    assert command[1:] == ["-m", "mypy"]
    assert invocation["cwd"] == tmp_path
    assert invocation["check"] is False

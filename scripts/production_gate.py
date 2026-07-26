"""Validate generated data and a staged Pages artifact for deployment."""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

import yaml

MAX_PAGES_BYTES = 100 * 1024 * 1024
LINK_PATTERN = re.compile(r"""(?:href|src)=["']([^"'#]+)["']""", re.IGNORECASE)


class ProductionGateError(RuntimeError):
    """Raised when a production-readiness invariant fails."""


def validate_python_types(repository: Path) -> None:
    """Run the repository's canonical strict mypy command."""
    result = subprocess.run(
        [sys.executable, "-m", "mypy"],
        cwd=repository,
        check=False,
    )
    if result.returncode != 0:
        raise ProductionGateError("strict Python type checking failed")


def verify_stage(stage: Path) -> None:
    """Load and invoke the established hyphenated staging module."""
    script = Path(__file__).with_name("stage-pages.py")
    spec = importlib.util.spec_from_file_location("stage_pages_gate", script)
    if spec is None or spec.loader is None:
        raise ProductionGateError("unable to load Pages staging validator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.verify_stage(stage)


def load_json(path: Path) -> object:
    """Load one strict JSON document."""
    with path.open("r", encoding="utf-8") as stream:
        return json.load(stream, parse_constant=lambda value: _invalid_number(value))


def _invalid_number(value: str) -> object:
    """Reject non-standard JSON numeric constants."""
    raise ValueError(f"non-finite JSON number: {value}")


def validate_geojson(value: object, label: str) -> None:
    """Validate the required GeoJSON FeatureCollection structure."""
    if not isinstance(value, dict) or value.get("type") != "FeatureCollection":
        raise ProductionGateError(f"{label} must be a FeatureCollection")
    features = value.get("features")
    if not isinstance(features, list):
        raise ProductionGateError(f"{label}.features must be an array")
    for index, feature in enumerate(features):
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise ProductionGateError(f"{label}.features[{index}] is invalid")
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") != "Point":
            raise ProductionGateError(f"{label}.features[{index}] must be a Point")


def validate_generated_x(repository: Path) -> None:
    """Validate X schema versions and one-report/one-feature output."""
    source = load_json(repository / "data/x_sources.json")
    events = load_json(repository / "data/output/x_report_events.json")
    geojson = load_json(repository / "data/output/x_report_pinpoints.geojson")
    if not isinstance(source, dict) or source.get("schema_version") != "1.0":
        raise ProductionGateError("x_sources.json schema version mismatch")
    reports = source.get("reports")
    if not isinstance(reports, list):
        raise ProductionGateError("x_sources.json reports must be an array")
    if not isinstance(events, dict) or events.get("schema_version") != "1.0":
        raise ProductionGateError("X event schema version mismatch")
    if not isinstance(geojson, dict) or geojson.get("schema_version") != "1.0":
        raise ProductionGateError("X GeoJSON schema version mismatch")
    validate_geojson(geojson, "x_report_pinpoints.geojson")
    if len(geojson["features"]) != len(reports):
        raise ProductionGateError("one X report must produce one GeoJSON feature")
    if events.get("generation_id") != geojson.get("generation_id"):
        raise ProductionGateError("X output generations do not match")


def validate_workflows(repository: Path) -> None:
    """Parse every GitHub Actions workflow as YAML."""
    for path in sorted((repository / ".github/workflows").glob("*.yml")):
        with path.open("r", encoding="utf-8") as stream:
            if not isinstance(yaml.safe_load(stream), dict):
                raise ProductionGateError(f"workflow is not a mapping: {path}")


def validate_local_links(stage: Path) -> None:
    """Require referenced local HTML assets to exist in staging."""
    for html in stage.rglob("*.html"):
        text = html.read_text(encoding="utf-8")
        for raw in LINK_PATTERN.findall(text):
            parsed = urlsplit(unquote(raw))
            if parsed.scheme or parsed.netloc or raw.startswith(("#", "data:")):
                continue
            target = (html.parent / parsed.path).resolve()
            if not target.is_relative_to(stage.resolve()) or not target.exists():
                raise ProductionGateError(
                    f"missing local asset referenced by {html}: {raw}"
                )


def validate_stage_size(stage: Path) -> int:
    """Enforce the documented Pages artifact size ceiling."""
    size = sum(path.stat().st_size for path in stage.rglob("*") if path.is_file())
    if size > MAX_PAGES_BYTES:
        raise ProductionGateError(
            f"Pages artifact is {size} bytes; limit is {MAX_PAGES_BYTES}"
        )
    return size


def run_gate(repository: Path, stage: Path) -> int:
    """Run every local production artifact validation."""
    repository = repository.resolve()
    stage = stage.resolve()
    validate_python_types(repository)
    verify_stage(stage)
    validate_stage_size(stage)
    validate_generated_x(repository)
    validate_workflows(repository)
    validate_local_links(stage)
    return 0


def main() -> int:
    """Parse paths and return a production gate exit code."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", type=Path, default=Path.cwd())
    parser.add_argument("--stage", type=Path, default=Path("_site"))
    args = parser.parse_args()
    stage = args.stage
    if not stage.is_absolute():
        stage = args.repository / stage
    try:
        return run_gate(args.repository, stage)
    except (OSError, ValueError, ProductionGateError) as error:
        print(f"Production gate failed: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

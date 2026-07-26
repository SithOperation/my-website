"""Build Sentinel Grid X report events and report-level map pinpoints."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from collectors.x_report_collector import load_x_reports
from processors.x_report_correlator import correlate_reports
from processors.x_report_normalizer import normalize_reports

ROOT = Path(__file__).resolve().parent


def build_report_geojson(reports: list[dict[str, Any]]) -> dict[str, Any]:
    """Build exactly one point feature for every normalized X report."""

    features: list[dict[str, Any]] = []
    for report in reports:
        properties = {
            key: value
            for key, value in report.items()
            if key
            not in {
                "claim_id",
                "fetch_attempted",
                "fetch_error",
                "fetch_succeeded",
                "fetched_text",
            }
        }
        properties["layer"] = "Social Media Early Reports"
        features.append(
            {
                "type": "Feature",
                "id": report["id"],
                "geometry": {
                    "type": "Point",
                    "coordinates": [report["longitude"], report["latitude"]],
                },
                "properties": properties,
            }
        )
    return {"type": "FeatureCollection", "features": features}


def build_x_report_layer(
    source_path: Path = ROOT / "data/x_sources.json",
    output_dir: Path = ROOT / "data/output",
    *,
    now: datetime | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Generate independent correlated events and report-level GeoJSON."""

    reports = normalize_reports(load_x_reports(source_path), now=now)
    logging.info("[X REPORTS] Normalized %d reports", len(reports))
    events = correlate_reports(reports)
    logging.info("[X REPORTS] Created %d event clusters", len(events))
    geojson = build_report_geojson(reports)
    logging.info(
        "[X REPORTS] Created %d report pinpoints",
        len(geojson["features"]),
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    paths = (
        (output_dir / "x_report_events.json", events),
        (output_dir / "x_report_pinpoints.geojson", geojson),
    )
    for path, payload in paths:
        path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        try:
            display_path = path.relative_to(ROOT)
        except ValueError:
            display_path = path
        logging.info("[X REPORTS] Exported %s", display_path)
    return events, geojson


def main() -> int:
    """Generate X outputs and return a process exit code."""

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        build_x_report_layer()
    except Exception as error:
        logging.error(
            "[X REPORTS] Layer build failed; existing Sentinel outputs may be "
            "partially updated: %s",
            error,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

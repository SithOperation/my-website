"""Build Sentinel Grid X report events and report-level map pinpoints."""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from collectors.x_report_collector import load_x_reports
from processors.x_report_correlator import correlate_reports
from processors.x_report_normalizer import normalize_reports
from storage.x_output_transaction import (
    OutputRollbackError,
    add_geojson_metadata,
    build_event_document,
    create_generation_metadata,
    publish_output_pair,
)

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
    generation_id: str | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Generate and transactionally publish events and report-level GeoJSON."""

    reports = normalize_reports(load_x_reports(source_path), now=now)
    logging.info("[X REPORTS] Normalized %d reports", len(reports))
    metadata = create_generation_metadata(now=now, generation_id=generation_id)
    events = correlate_reports(reports, updated_at=metadata["generated_at"])
    logging.info("[X REPORTS] Created %d event clusters", len(events))
    event_document = build_event_document(events, metadata)
    geojson = add_geojson_metadata(build_report_geojson(reports), metadata)
    logging.info(
        "[X REPORTS] Created %d report pinpoints",
        len(geojson["features"]),
    )
    publish_output_pair(
        output_dir,
        event_document,
        geojson,
        expected_report_count=len(reports),
    )
    logging.info(
        "[X REPORTS] Published generation %s at %s: %d reports, %d events, %d features",
        metadata["generation_id"],
        metadata["generated_at"],
        len(reports),
        len(events),
        len(geojson["features"]),
    )
    logging.info(
        "[X REPORTS] Both canonical outputs share generation %s: %s and %s",
        metadata["generation_id"],
        output_dir / "x_report_events.json",
        output_dir / "x_report_pinpoints.geojson",
    )
    return events, geojson


def main() -> int:
    """Generate X outputs and return a process exit code."""

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        build_x_report_layer()
    except OutputRollbackError as error:
        logging.critical("[X REPORTS] %s", error)
        return 2
    except Exception as error:
        logging.error("[X REPORTS] Generation or publication failed: %s", error)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

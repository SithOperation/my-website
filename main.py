"""Build the Sentinel Grid Social Media Early Reports data layer."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from collectors.x_report_collector import load_x_reports
from processors.x_report_correlator import correlate_reports
from processors.x_report_normalizer import normalize_reports

ROOT = Path(__file__).resolve().parent


def build_x_report_layer(source_path: Path = ROOT / "data/x_sources.json", output_dir: Path = ROOT / "data/output") -> tuple[list[dict], dict]:
    reports = normalize_reports(load_x_reports(source_path))
    logging.info("[X REPORTS] Normalized %d reports", len(reports))
    events = correlate_reports(reports)
    logging.info("[X REPORTS] Created %d event clusters", len(events))
    geojson = {"type": "FeatureCollection", "features": [{
        "type": "Feature", "geometry": {"type": "Point", "coordinates": [event["longitude"], event["latitude"]]},
        "properties": {key: value for key, value in event.items() if key not in {"latitude", "longitude"}},
    } for event in events]}
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = [(output_dir / "x_report_events.json", events), (output_dir / "x_report_pinpoints.geojson", geojson)]
    for path, payload in paths:
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        try:
            display_path = path.relative_to(ROOT)
        except ValueError:
            display_path = path
        logging.info("[X REPORTS] Exported %s", display_path)
    return events, geojson


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        build_x_report_layer()
    except Exception as error:
        logging.error("[X REPORTS] Layer build failed; existing Sentinel outputs were not affected: %s", error)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

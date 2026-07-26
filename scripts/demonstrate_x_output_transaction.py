"""Demonstrate successful X output publication and failure rollback."""

from __future__ import annotations

import copy
import json
import os
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from main import build_x_report_layer
from storage.x_output_transaction import (
    EVENT_FILENAME,
    GEOJSON_FILENAME,
    OutputPublicationError,
    publish_output_pair,
    serialize_document,
)


def _source_report(
    status_id: str,
    account: str,
    latitude: float,
) -> dict[str, object]:
    """Build one deterministic schema 1.0 demonstration report."""

    return {
        "schema_version": "1.0",
        "status_id": status_id,
        "account": account,
        "source_url": f"https://x.com/{account}/status/{status_id}",
        "published_at": "2026-07-26T15:00:00Z",
        "collected_at": "2026-07-26T15:05:00Z",
        "summary": "Controlled early report.",
        "event_type": "reported_strike",
        "source_class": "social_media_osint",
        "verification_status": "not_independently_verified",
        "confidence": 0.6,
        "latitude": latitude,
        "longitude": 0.0,
        "location_name": "Controlled Location",
        "location_precision": "exact",
        "quoted_url": None,
        "reposted_url": None,
    }


def _write_old_pair(output_dir: Path) -> None:
    """Write a known valid empty generation as the rollback baseline."""

    metadata = {
        "schema_version": "1.0",
        "generation_id": "generation-old",
        "generated_at": "2026-07-26T14:00:00Z",
    }
    output_dir.mkdir(parents=True)
    (output_dir / EVENT_FILENAME).write_bytes(
        serialize_document({**metadata, "events": []})
    )
    (output_dir / GEOJSON_FILENAME).write_bytes(
        serialize_document(
            {
                "type": "FeatureCollection",
                **metadata,
                "features": [],
            }
        )
    )


def main() -> int:
    """Run and print the controlled Phase 5 demonstration."""

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        output_dir = root / "output"
        source_path = root / "x_sources.json"
        _write_old_pair(output_dir)
        reports = [
            _source_report("1", "a", 0.0),
            _source_report("2", "b", 0.2),
        ]
        source_path.write_text(
            json.dumps({"schema_version": "1.0", "reports": reports}),
            encoding="utf-8",
        )
        events, geojson = build_x_report_layer(
            source_path,
            output_dir,
            now=datetime(2026, 7, 26, 16, tzinfo=UTC),
            generation_id="generation-success",
        )
        visible_events = json.loads(
            (output_dir / EVENT_FILENAME).read_text(encoding="utf-8")
        )
        visible_geojson = json.loads(
            (output_dir / GEOJSON_FILENAME).read_text(encoding="utf-8")
        )
        print("Old generation: generation-old")
        print(f"New generation: {visible_events['generation_id']}")
        print(f"Input reports: {len(reports)}")
        print(f"Correlated events: {len(events)}")
        print(f"GeoJSON features: {len(geojson['features'])}")
        print(
            "Both outputs generation ID identical: "
            f"{visible_events['generation_id'] == visible_geojson['generation_id']}"
        )
        print("Publication result: success")

        failed_events = copy.deepcopy(visible_events)
        failed_geojson = copy.deepcopy(visible_geojson)
        for document in (failed_events, failed_geojson):
            document["generation_id"] = "generation-failed"
            document["generated_at"] = "2026-07-26T17:00:00Z"
        replacement_calls = 0

        def fail_second_replace(source: str | Path, target: str | Path) -> None:
            nonlocal replacement_calls
            replacement_calls += 1
            if replacement_calls == 2:
                raise OSError("injected second canonical replacement failure")
            os.replace(source, target)

        exit_code = 0
        try:
            publish_output_pair(
                output_dir,
                failed_events,
                failed_geojson,
                expected_report_count=2,
                replace=fail_second_replace,
            )
        except OutputPublicationError:
            exit_code = 1
        after_events = json.loads(
            (output_dir / EVENT_FILENAME).read_text(encoding="utf-8")
        )
        after_geojson = json.loads(
            (output_dir / GEOJSON_FILENAME).read_text(encoding="utf-8")
        )
        temporary_count = len(list(output_dir.glob(".x_report_*")))
        mixed = after_events["generation_id"] != after_geojson["generation_id"]
        print("Attempted generation: generation-failed")
        print("Injected failure point: second canonical replacement")
        print(
            f"Visible event generation after failure: {after_events['generation_id']}"
        )
        print(
            "Visible GeoJSON generation after failure: "
            f"{after_geojson['generation_id']}"
        )
        print(f"Mixed generation visible: {'yes' if mixed else 'no'}")
        print(f"Temporary files remaining: {temporary_count}")
        print(f"Exit code: {exit_code}")
        return 0 if not mixed and temporary_count == 0 and exit_code != 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

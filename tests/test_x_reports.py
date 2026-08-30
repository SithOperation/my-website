"""Tests for X report correlation, generation, and map integration."""

from __future__ import annotations

import copy
import itertools
import json
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from collectors.x_report_collector import load_x_reports, normalize_x_url
from main import build_x_report_layer
from models.x_report_model import stable_claim_id, stable_report_id
from processors.x_report_correlator import (
    correlate_reports,
    count_independent_sources,
    event_types_similar,
    haversine_km,
)
from processors.x_report_normalizer import normalize_report

REFERENCE_TIME = datetime(2026, 7, 26, 16, 0, tzinfo=UTC)


def source_report(status_id: str = "1", **changes: object) -> dict[str, object]:
    """Build a valid schema 1.0 source report."""

    value: dict[str, object] = {
        "schema_version": "1.0",
        "status_id": status_id,
        "account": "a",
        "source_url": f"https://x.com/a/status/{status_id}",
        "published_at": "2026-07-26T15:00:00Z",
        "collected_at": "2026-07-26T15:05:00Z",
        "summary": "strike",
        "event_type": "reported_strike",
        "source_class": "social_media_osint",
        "verification_status": "not_independently_verified",
        "confidence": 0.6,
        "latitude": 0.0,
        "longitude": 0.0,
        "location_name": "A",
        "location_precision": "exact",
        "quoted_url": None,
        "reposted_url": None,
    }
    value.update(changes)
    return value


def report(status_id: str = "1", **changes: object) -> dict[str, object]:
    """Build a normalized report for correlation tests."""

    return normalize_report(source_report(status_id, **changes))


def write_source(path: Path, reports: list[dict[str, object]]) -> None:
    """Write a schema 1.0 source document."""

    path.write_text(
        json.dumps({"schema_version": "1.0", "reports": reports}),
        encoding="utf-8",
    )


class XReportTests(unittest.TestCase):
    """Verify report-level markers remain independent from correlation."""

    def test_haversine(self) -> None:
        """The distance helper returns the expected equatorial distance."""

        self.assertAlmostEqual(haversine_km(0, 0, 0, 1), 111.2, delta=0.2)

    def test_url_normalization(self) -> None:
        """Legacy public links canonicalize to x.com status URLs."""

        self.assertEqual(
            normalize_x_url("https://twitter.com/A/status/123?s=20"),
            "https://x.com/A/status/123",
        )

    def test_stable_ids(self) -> None:
        """Report and claim identities are deterministic."""

        item = report()
        self.assertEqual(stable_report_id(item), stable_report_id(dict(item)))
        self.assertEqual(stable_claim_id(item), stable_claim_id(dict(item)))
        repost = dict(
            item,
            source_url="https://x.com/b/status/2",
            reposted_url=item["source_url"],
        )
        self.assertEqual(stable_claim_id(item), stable_claim_id(repost))

    def test_independent_source_and_repost_deduplication(self) -> None:
        """Accounts, rather than claims or posts, define independent sources."""

        self.assertEqual(
            count_independent_sources([report(), report("2", account="b")]),
            2,
        )
        same_claim = report("2")
        same_claim["claim_id"] = report()["claim_id"]
        self.assertEqual(count_independent_sources([report(), same_claim]), 1)
        different_account_same_claim = report(
            "3",
            account="b",
            source_url="https://x.com/b/status/3",
        )
        different_account_same_claim["claim_id"] = report()["claim_id"]
        self.assertEqual(
            count_independent_sources([report(), different_account_same_claim]),
            2,
        )

    def test_correlation_is_permutation_invariant_with_bridge_report(self) -> None:
        """A bridge joins preexisting components regardless of input order."""

        items = [
            report("1", latitude=0.0),
            report("2", account="b", latitude=1.8),
            report("3", account="c", latitude=0.9),
        ]
        signatures = []
        for permutation in itertools.permutations(items):
            events = correlate_reports(list(permutation), radius_km=125)
            signatures.append(
                [
                    (
                        event["id"],
                        [item["id"] for item in event["reports"]],
                    )
                    for event in events
                ]
            )
        self.assertTrue(all(value == signatures[0] for value in signatures))
        self.assertEqual(len(signatures[0]), 1)

    def test_stable_event_identity_and_update_time(self) -> None:
        """Unrelated input and regeneration time do not churn an event."""

        related = [
            report("1"),
            report(
                "2",
                account="b",
                source_url="https://x.com/b/status/2",
                latitude=0.2,
            ),
        ]
        first = correlate_reports(related, updated_at="2026-07-26T16:00:00Z")
        second = correlate_reports(
            [
                *related,
                report(
                    "9",
                    account="z",
                    source_url="https://x.com/z/status/9",
                    latitude=20.0,
                ),
            ],
            updated_at="2026-07-26T17:00:00Z",
        )
        existing = next(event for event in second if event["report_count"] == 2)
        self.assertEqual(first[0]["id"], existing["id"])
        self.assertEqual(first[0]["last_updated_at"], existing["last_updated_at"])

    def test_nearby_unrelated_event_types_remain_separate(self) -> None:
        """Proximity alone cannot correlate semantically unrelated reports."""

        events = correlate_reports(
            [
                report("1", event_type="reported_strike"),
                report(
                    "2",
                    account="b",
                    source_url="https://x.com/b/status/2",
                    event_type="diplomatic_statement",
                    latitude=0.01,
                ),
            ]
        )
        self.assertEqual(len(events), 2)

    def test_geographic_and_event_clustering(self) -> None:
        """Nearby similar reports can still form one intelligence event."""

        events = correlate_reports(
            [
                report(),
                report("2", latitude=0.2),
                report("3", latitude=5),
            ]
        )
        self.assertEqual(
            sorted(event["report_count"] for event in events),
            [1, 2],
        )
        self.assertTrue(
            event_types_similar("official_strike_statement", "reported_strike")
        )
        self.assertFalse(event_types_similar("diplomatic_statement", "reported_strike"))

    def test_country_does_not_merge_with_facility(self) -> None:
        """Country-level reports remain separate from precise reports."""

        events = correlate_reports(
            [
                report(location_precision="country"),
                report("2", latitude=0.01),
            ]
        )
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["source_status"], "unable to verify")

    def test_website_loader_performs_no_network_collection(self) -> None:
        """The website only consumes the authoritative synchronized feed."""

        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "source.json"
            write_source(path, [source_report()])
            loaded = load_x_reports(path)
        self.assertEqual(loaded[0]["summary"], "strike")

    def build(
        self,
        reports: list[dict[str, object]],
        output: Path,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """Write source reports and run the complete generator."""

        source = output.parent / "x_sources.json"
        write_source(source, reports)
        return build_x_report_layer(source, output, now=REFERENCE_TIME)

    def test_zero_reports_generate_zero_features(self) -> None:
        """An empty valid feed produces empty event and feature arrays."""

        with tempfile.TemporaryDirectory() as folder:
            events, geojson = self.build([], Path(folder) / "output")
        self.assertEqual(events, [])
        self.assertEqual(geojson["features"], [])

    def test_one_report_generates_one_feature_with_metadata(self) -> None:
        """One report produces one complete report-level point feature."""

        source = source_report()
        with tempfile.TemporaryDirectory() as folder:
            events, geojson = self.build([source], Path(folder) / "output")
        self.assertEqual(len(events), 1)
        self.assertEqual(len(geojson["features"]), 1)
        feature = geojson["features"][0]
        self.assertEqual(feature["geometry"]["coordinates"], [0.0, 0.0])
        for field in source:
            self.assertEqual(feature["properties"][field], source[field])

    def test_two_correlated_reports_generate_two_features(self) -> None:
        """Correlation may group events but never suppress report markers."""

        first = source_report()
        second = source_report(
            "2",
            account="b",
            source_url="https://x.com/b/status/2",
            latitude=0.2,
        )
        with tempfile.TemporaryDirectory() as folder:
            events, geojson = self.build(
                [first, second],
                Path(folder) / "output",
            )
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["report_count"], 2)
        self.assertEqual(len(geojson["features"]), 2)

    def test_expired_report_generates_no_feature(self) -> None:
        """Reports outside retention disappear from both generated products."""

        expired = source_report(
            published_at=(REFERENCE_TIME - timedelta(hours=49)).isoformat(),
            collected_at=(REFERENCE_TIME - timedelta(hours=48, minutes=55)).isoformat(),
        )
        with tempfile.TemporaryDirectory() as folder:
            events, geojson = self.build([expired], Path(folder) / "output")
        self.assertEqual(events, [])
        self.assertEqual(geojson["features"], [])

    def test_invalid_coordinates_are_rejected(self) -> None:
        """Invalid coordinates cannot enter generated GeoJSON."""

        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, "latitude"):
                self.build(
                    [source_report(latitude=True)],
                    Path(folder) / "output",
                )

    def test_duplicate_status_id_is_rejected(self) -> None:
        """Duplicate report identities are rejected deterministically."""

        duplicate = copy.deepcopy(source_report())
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, "duplicated"):
                self.build(
                    [source_report(), duplicate],
                    Path(folder) / "output",
                )

    def test_removed_report_removes_existing_marker(self) -> None:
        """Regeneration replaces stale marker content after source removal."""

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            output = root / "output"
            self.build([source_report()], output)
            self.build([], output)
            geojson = json.loads(
                (output / "x_report_pinpoints.geojson").read_text(encoding="utf-8")
            )
        self.assertEqual(geojson["features"], [])

    def test_popup_implementation_uses_dom_text(self) -> None:
        """Existing popup construction avoids unsafe HTML insertion."""

        script = Path("assets/js/sentinel-map.js").read_text(encoding="utf-8")
        self.assertIn("buildEarlyReportDetail", script)
        self.assertIn("textContent", script)
        self.assertNotIn("earlyReportPopup.setHTML", script)

    def test_x_markers_remain_individual_at_global_zoom(self) -> None:
        """X reports use their own source without numbered clustering."""

        script = Path("assets/js/sentinel-map.js").read_text(encoding="utf-8")
        self.assertIn('map.addImage("x-early-report-pinpoint"', script)
        self.assertIn('map.addSource("x-early-reports-source"', script)
        self.assertNotIn('id: "x-early-report-clusters"', script)
        self.assertNotIn('id: "x-early-report-cluster-count"', script)
        self.assertIn('"icon-allow-overlap": true', script)


if __name__ == "__main__":
    unittest.main()

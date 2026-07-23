import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from collectors.x_report_collector import load_x_reports, normalize_x_url
from main import build_x_report_layer
from models.x_report_model import stable_claim_id, stable_report_id
from processors.x_report_correlator import correlate_reports, count_independent_sources, event_types_similar, haversine_km


def report(**changes):
    value = {"id": "r1", "claim_id": "c1", "url": "https://x.com/a/status/1", "account": "a", "text": "strike", "published_at": None, "collected_at": "2026-01-01T00:00:00Z", "source_class": "social_media_osint", "location_name": "A", "latitude": 0.0, "longitude": 0.0, "location_precision": "exact", "event_type": "reported_strike", "verification_status": "not independently verified", "source_status": "single-source report", "quoted_source": None, "reposted_from": None, "fetch_attempted": False, "fetch_succeeded": False, "fetch_error": None}
    value.update(changes)
    return value


class XReportTests(unittest.TestCase):
    def test_haversine(self):
        self.assertAlmostEqual(haversine_km(0, 0, 0, 1), 111.2, delta=.2)

    def test_url_normalization(self):
        self.assertEqual(normalize_x_url("https://twitter.com/A/status/123?s=20"), "https://x.com/A/status/123")

    def test_stable_ids(self):
        item = report()
        self.assertEqual(stable_report_id(item), stable_report_id(dict(item)))
        self.assertEqual(stable_claim_id(item), stable_claim_id(dict(item)))
        repost = dict(item, url="https://x.com/b/status/2", reposted_from=item["url"])
        self.assertEqual(stable_claim_id(item), stable_claim_id(repost))

    def test_independent_source_and_repost_deduplication(self):
        self.assertEqual(count_independent_sources([report(), report(id="r2", account="b")]), 1)
        self.assertEqual(count_independent_sources([report(), report(id="r2", claim_id="c2")]), 2)

    def test_geographic_and_event_clustering(self):
        events = correlate_reports([report(), report(id="r2", claim_id="c2", latitude=.2), report(id="r3", claim_id="c3", latitude=5)])
        self.assertEqual([event["report_count"] for event in events], [2, 1])
        self.assertTrue(event_types_similar("official_strike_statement", "reported_strike"))
        self.assertFalse(event_types_similar("diplomatic_statement", "reported_strike"))

    def test_country_does_not_merge_with_facility(self):
        events = correlate_reports([report(location_precision="country"), report(id="r2", latitude=.01)])
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["source_status"], "unable to verify")

    def test_failed_fetch_does_not_crash(self):
        source = {"reports": [{"url": "https://x.com/a/status/1", "account": "a", "text": "manual", "source_class": "social_media_osint", "location_name": "A", "latitude": 0, "longitude": 0, "location_precision": "city", "event_type": "reported_strike"}]}
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "source.json"
            path.write_text(json.dumps(source), encoding="utf-8")
            with patch("collectors.x_report_collector._fetch_public_text", side_effect=TimeoutError("timed out")):
                loaded = load_x_reports(path, fetch_enabled=True)
        self.assertEqual(loaded[0]["text"], "manual")
        self.assertIn("TimeoutError", loaded[0]["fetch_error"])

    def test_geojson_order_and_official_caution(self):
        with tempfile.TemporaryDirectory() as folder:
            events, geojson = build_x_report_layer(output_dir=Path(folder))
        first = events[0]
        self.assertEqual(geojson["features"][0]["geometry"]["coordinates"], [first["longitude"], first["latitude"]])
        official = next(event for event in events if "official_military" in event["source_classes"])
        self.assertEqual(official["source_status"], "official-source report")
        self.assertEqual(official["verification_status"], "not independently verified")

    def test_popup_implementation_uses_dom_text(self):
        script = Path("assets/js/sentinel-map.js").read_text(encoding="utf-8")
        self.assertIn("buildEarlyReportDetail", script)
        self.assertIn("textContent", script)
        self.assertNotIn("earlyReportPopup.setHTML", script)

    def test_x_markers_have_a_separate_cluster_source(self):
        script = Path("assets/js/sentinel-map.js").read_text(encoding="utf-8")
        self.assertIn('map.addImage("x-early-report-pinpoint"', script)
        self.assertIn('map.addSource("x-early-reports-source"', script)
        self.assertIn('id: "x-early-report-clusters"', script)
        self.assertNotIn('source: "sentinel-events",\n            filter: ["has", "point_count"],\n            layout: {\n                "icon-image": "x-early-report-pinpoint"', script)


if __name__ == "__main__":
    unittest.main()

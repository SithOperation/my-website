import importlib.util
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "sync-monitor-data.py"
SPEC = importlib.util.spec_from_file_location("sync_monitor_data", MODULE_PATH)
sync_monitor_data = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = sync_monitor_data
SPEC.loader.exec_module(sync_monitor_data)


class SyncMonitorDataTests(unittest.TestCase):
    def write_sentinel_publication(self, root):
        output = root / "source"
        output.mkdir()
        values = {
            "dashboard.json": {"generated": "2026-07-23T13:49:32Z"},
            "intelligence_brief.json": {"title": "Brief"},
            "map_events.json": [{"event_id": "one"}],
            "timeline.json": [{"event_id": "one"}],
            "trends.json": {"total_events": 1},
            "world_events.json": {"events": [{"event_id": "one"}]},
            "health.json": {"status": "healthy"},
        }
        files = {}
        for filename, value in values.items():
            payload = (json.dumps(value) + "\n").encode()
            (output / filename).write_bytes(payload)
            files[filename] = {
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        (output / "manifest.json").write_text(
            json.dumps(
                {
                    "schema_version": "1.0",
                    "publication_id": "test-publication",
                    "files": files,
                }
            ),
            encoding="utf-8",
        )
        return output

    def test_valid_ai_digest_replaces_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.json"
            destination = root / "data" / "ai_cyber_digest.json"
            source.write_text(
                json.dumps(
                    {
                        "generated_at": "2026-07-23T13:49:32Z",
                        "stories": [
                            {
                                "title": "Report",
                                "source": "Publisher",
                                "source_url": "https://example.test/report",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            result = sync_monitor_data.publish_file(
                source,
                destination,
                sync_monitor_data.validate_ai_digest,
            )

            self.assertEqual(result.status, "updated")
            self.assertEqual(json.loads(destination.read_text())["stories"][0]["title"], "Report")

    def test_empty_x_sources_feed_is_valid(self):
        sync_monitor_data.validate_x_sources(
            {"schema_version": "1.0", "reports": []},
            "x_sources.json",
        )

    def test_x_sources_requires_publication_timestamp(self):
        document = json.loads(
            (
                Path(__file__).parent
                / "fixtures"
                / "x_sources_valid.json"
            ).read_text(encoding="utf-8")
        )
        document["reports"][0]["published_at"] = None
        with self.assertRaisesRegex(ValueError, "published_at"):
            sync_monitor_data.validate_x_sources(
                document,
                "x_sources.json",
            )

    def test_invalid_download_preserves_last_known_good(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.json"
            destination = root / "data.json"
            destination.write_text('{"valid": true}', encoding="utf-8")
            source.write_text('{"stories": []}', encoding="utf-8")

            result = sync_monitor_data.publish_file(
                source,
                destination,
                sync_monitor_data.validate_ai_digest,
            )

            self.assertEqual(result.status, "failed")
            self.assertEqual(destination.read_text(encoding="utf-8"), '{"valid": true}')

    def test_malformed_ai_json_preserves_last_known_good(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.json"
            destination = root / "data.json"
            destination.write_text('{"valid": true}', encoding="utf-8")
            source.write_text('{"stories": [', encoding="utf-8")

            result = sync_monitor_data.publish_file(
                source,
                destination,
                sync_monitor_data.validate_ai_digest,
            )

            self.assertEqual(result.status, "failed")
            self.assertEqual(destination.read_text(encoding="utf-8"), '{"valid": true}')

    def test_missing_source_preserves_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            destination = root / "data.json"
            destination.write_text('{"valid": true}', encoding="utf-8")

            result = sync_monitor_data.publish_file(
                root / "missing.json",
                destination,
                sync_monitor_data.validate_ai_digest,
            )

            self.assertEqual(result.status, "skipped")
            self.assertEqual(destination.read_text(encoding="utf-8"), '{"valid": true}')

    def test_z_and_offset_timestamps_parse(self):
        utc = sync_monitor_data.parse_generated("2026-07-23T13:49:32Z")
        offset = sync_monitor_data.parse_generated("2026-07-23T09:49:32-04:00")

        self.assertEqual(utc, offset)

    def test_malformed_timestamp_returns_none(self):
        self.assertIsNone(sync_monitor_data.parse_generated("not-a-date"))

    def test_empty_event_array_is_rejected(self):
        with self.assertRaises(ValueError):
            sync_monitor_data.validate_event_array([], "events.json")

    def test_valid_ews_state(self):
        sync_monitor_data.validate_ews_state(
            {
                "level": 2,
                "concurrent_count": 10,
                "z_score": 1.5,
                "last_checked": "2026-07-23T13:49:32Z",
                "as_of": "2026-07-23T09:49:32-04:00",
            },
            "ews_state.json",
        )

    def test_ews_only_mode_preserves_last_known_good_then_updates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "external" / "ews" / "state.json"
            destination = root / "data" / "ews_state.json"
            source.parent.mkdir(parents=True)
            destination.parent.mkdir(parents=True)
            destination.write_text('{"level": 1}', encoding="utf-8")
            source.write_text('{"level": 9}', encoding="utf-8")

            rejected = sync_monitor_data.sync_ews(root)

            self.assertEqual(rejected.status, "failed")
            self.assertEqual(destination.read_text(encoding="utf-8"), '{"level": 1}')

            source.write_text(
                json.dumps(
                    {
                        "level": 2,
                        "concurrent_count": 10,
                        "z_score": 1.5,
                        "last_checked": "2026-07-23T13:49:32Z",
                        "as_of": "2026-07-23T13:49:32Z",
                    }
                ),
                encoding="utf-8",
            )
            updated = sync_monitor_data.sync_ews(root)

            self.assertEqual(updated.status, "updated")
            self.assertEqual(json.loads(destination.read_text())["level"], 2)

    def test_valid_sentinel_publication_is_published(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.write_sentinel_publication(root)
            destination = root / "destination"

            results = sync_monitor_data.publish_sentinel(source, destination)

            self.assertTrue(all(result.status == "updated" for result in results))
            self.assertEqual(
                json.loads((destination / "manifest.json").read_text())["publication_id"],
                "test-publication",
            )

    def test_bad_sentinel_checksum_preserves_last_known_good(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.write_sentinel_publication(root)
            destination = root / "destination"
            destination.mkdir()
            marker = destination / "map_events.json"
            marker.write_text('[{"event_id": "last-known-good"}]', encoding="utf-8")
            (source / "map_events.json").write_text("[]", encoding="utf-8")

            results = sync_monitor_data.publish_sentinel(source, destination)

            self.assertTrue(all(result.status == "failed" for result in results))
            self.assertEqual(
                json.loads(marker.read_text())[0]["event_id"], "last-known-good"
            )


if __name__ == "__main__":
    unittest.main()

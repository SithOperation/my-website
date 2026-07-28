import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import yaml

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "sync-monitor-data.py"
SPEC = importlib.util.spec_from_file_location("sync_monitor_data", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load synchronization module: {MODULE_PATH}")
sync_monitor_data = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = sync_monitor_data
SPEC.loader.exec_module(sync_monitor_data)

type JsonValue = (
    str | int | float | bool | None | list["JsonValue"] | dict[str, "JsonValue"]
)


class SyncMonitorDataTests(unittest.TestCase):
    def write_sentinel_publication(self, root: Path) -> Path:
        output = root / "source"
        output.mkdir()
        values: dict[str, JsonValue] = {
            "dashboard.json": {"generated": "2026-07-23T13:49:32Z"},
            "intelligence_brief.json": {"title": "Brief"},
            "map_events.json": [{"event_id": "one"}],
            "timeline.json": [{"event_id": "one"}],
            "trends.json": {"total_events": 1},
            "world_events.json": {"events": [{"event_id": "one"}]},
            "health.json": {"status": "healthy"},
            "x_reports.json": {"schema_version": "1.0", "reports": []},
            "x_report_events.json": {
                "schema_version": "1.0",
                "generation_id": "sentinel-test",
                "generated_at": "2026-07-23T13:49:32Z",
                "events": [],
            },
            "x_report_pinpoints.geojson": {
                "schema_version": "1.0",
                "generation_id": "sentinel-test",
                "generated_at": "2026-07-23T13:49:32Z",
                "type": "FeatureCollection",
                "features": [],
            },
        }
        files: dict[str, JsonValue] = {}
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
                    "generated": "2026-07-23T13:49:32Z",
                    "files": files,
                }
            ),
            encoding="utf-8",
        )
        return output

    def test_valid_ai_digest_replaces_destination(self) -> None:
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
            self.assertEqual(
                json.loads(destination.read_text())["stories"][0]["title"], "Report"
            )

    def test_empty_x_sources_feed_is_valid(self) -> None:
        sync_monitor_data.validate_x_sources(
            {"schema_version": "1.0", "reports": []},
            "x_sources.json",
        )

    def test_x_sources_requires_publication_timestamp(self) -> None:
        document = json.loads(
            (Path(__file__).parent / "fixtures" / "x_sources_valid.json").read_text(
                encoding="utf-8"
            )
        )
        document["reports"][0]["published_at"] = None
        with self.assertRaisesRegex(ValueError, "published_at"):
            sync_monitor_data.validate_x_sources(
                document,
                "x_sources.json",
            )

    def test_invalid_download_preserves_last_known_good(self) -> None:
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

    def test_malformed_ai_json_preserves_last_known_good(self) -> None:
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

    def test_missing_source_preserves_destination(self) -> None:
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

    def test_z_and_offset_timestamps_parse(self) -> None:
        utc = sync_monitor_data.parse_generated("2026-07-23T13:49:32Z")
        offset = sync_monitor_data.parse_generated("2026-07-23T09:49:32-04:00")

        self.assertEqual(utc, offset)

    def test_naive_timestamp_is_rejected_explicitly(self) -> None:
        with self.assertRaisesRegex(ValueError, "timezone"):
            sync_monitor_data.parse_generated("2026-07-23T13:49:32")

    def test_malformed_timestamp_returns_none(self) -> None:
        self.assertIsNone(sync_monitor_data.parse_generated("not-a-date"))

    def test_empty_event_array_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            sync_monitor_data.validate_event_array([], "events.json")

    def test_valid_ews_state(self) -> None:
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

    def test_ews_only_mode_preserves_last_known_good_then_updates(self) -> None:
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

    def test_valid_sentinel_publication_is_published(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.write_sentinel_publication(root)
            destination = root / "destination"

            results = sync_monitor_data.publish_sentinel(source, destination)

            self.assertTrue(all(result.status == "updated" for result in results))
            self.assertEqual(
                json.loads((destination / "manifest.json").read_text())[
                    "publication_id"
                ],
                "test-publication",
            )
            self.assertTrue((destination / "x_sources.json").is_file())
            self.assertTrue(
                (destination / "output" / "x_report_pinpoints.geojson").is_file()
            )

    def test_bad_sentinel_checksum_preserves_last_known_good(self) -> None:
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

    def test_sentinel_and_disaster_staging_are_independent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sentinel_source = self.write_sentinel_publication(root)
            sentinel_stage = root / "staged" / "sentinel"
            disaster_stage = root / "staged" / "disaster"

            sentinel_results = sync_monitor_data.sync_sentinel(
                sentinel_source, sentinel_stage
            )
            disaster_results = sync_monitor_data.sync_disaster(
                root / "missing-disaster", disaster_stage
            )

            self.assertTrue(sync_monitor_data.source_sync_succeeded(sentinel_results))
            self.assertFalse(sync_monitor_data.source_sync_succeeded(disaster_results))
            self.assertEqual(
                json.loads((sentinel_stage / "manifest.json").read_text())[
                    "publication_id"
                ],
                "test-publication",
            )
            self.assertFalse(disaster_stage.exists())

    def test_invalid_sentinel_does_not_modify_existing_stage(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.write_sentinel_publication(root)
            stage = root / "staged"
            stage.mkdir()
            marker = stage / "map_events.json"
            marker.write_text('[{"event_id": "preserved"}]', encoding="utf-8")
            (source / "map_events.json").write_text("[]", encoding="utf-8")

            results = sync_monitor_data.sync_sentinel(source, stage)

            self.assertFalse(sync_monitor_data.source_sync_succeeded(results))
            self.assertEqual(
                json.loads(marker.read_text())[0]["event_id"], "preserved"
            )

    def test_older_sentinel_publication_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.write_sentinel_publication(root)
            destination = root / "destination"
            destination.mkdir()
            marker = destination / "map_events.json"
            marker.write_text('[{"event_id": "newer"}]', encoding="utf-8")
            (destination / "manifest.json").write_text(
                json.dumps(
                    {
                        "publication_id": "newer-publication",
                        "generated": "2026-07-24T13:49:32Z",
                    }
                ),
                encoding="utf-8",
            )

            results = sync_monitor_data.publish_sentinel(source, destination)

            self.assertTrue(all(result.status == "failed" for result in results))
            self.assertIn("older than", results[0].detail)
            self.assertEqual(json.loads(marker.read_text())[0]["event_id"], "newer")

    def test_sentinel_transaction_rolls_back_partial_replacement(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.write_sentinel_publication(root)
            destination = root / "destination"
            destination.mkdir()
            dashboard = destination / "dashboard.json"
            brief = destination / "intelligence_brief.json"
            dashboard.write_text('{"release": "old"}', encoding="utf-8")
            brief.write_text('{"release": "old"}', encoding="utf-8")
            real_atomic_replace = sync_monitor_data.atomic_replace
            calls = 0

            def fail_second_replace(path: Path, payload: bytes) -> None:
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("simulated replacement failure")
                real_atomic_replace(path, payload)

            with mock.patch.object(
                sync_monitor_data,
                "atomic_replace",
                side_effect=fail_second_replace,
            ):
                results = sync_monitor_data.publish_sentinel(source, destination)

            self.assertTrue(all(result.status == "failed" for result in results))
            self.assertEqual(json.loads(dashboard.read_text())["release"], "old")
            self.assertEqual(json.loads(brief.read_text())["release"], "old")
            self.assertFalse((destination / "map_events.json").exists())

    def test_sync_workflow_isolates_sentinel_from_disaster_authentication(self) -> None:
        workflow_path = (
            Path(__file__).parents[1] / ".github" / "workflows" / "sync-states.yml"
        )
        workflow = yaml.safe_load(workflow_path.read_text(encoding="utf-8"))
        jobs = workflow["jobs"]

        self.assertIn("sync-sentinel", jobs)
        self.assertIn("sync-disaster", jobs)
        self.assertEqual(jobs["sync-sentinel"]["needs"], "gate")
        self.assertEqual(jobs["sync-disaster"]["needs"], "gate")
        sentinel_text = json.dumps(jobs["sync-sentinel"])
        disaster_text = json.dumps(jobs["sync-disaster"])
        self.assertNotIn("REPO_ACCESS_TOKEN", sentinel_text)
        self.assertIn("REPO_ACCESS_TOKEN", disaster_text)
        self.assertIn("validated-sentinel", sentinel_text)
        self.assertIn("validated-disaster", disaster_text)

    def test_sync_workflow_deploys_the_commit_created_by_the_sync(self) -> None:
        workflows = Path(__file__).parents[1] / ".github" / "workflows"
        sync_workflow = yaml.safe_load(
            (workflows / "sync-states.yml").read_text(encoding="utf-8")
        )
        pages_workflow = yaml.safe_load(
            (workflows / "pages.yml").read_text(encoding="utf-8")
        )
        jobs = sync_workflow["jobs"]

        commit_job = json.dumps(jobs["commit-data"])
        resolve_job = json.dumps(jobs["resolve-deployment"])
        deploy_job = json.dumps(jobs["deploy"])
        pages_text = json.dumps(pages_workflow)
        self.assertIn("git rev-parse HEAD", commit_job)
        self.assertIn("commit_sha", commit_job)
        self.assertIn("PRODUCTION_PUBLICATION", resolve_job)
        self.assertIn("needs.resolve-deployment.outputs.commit_sha", deploy_job)
        self.assertNotIn("github.sha", deploy_job)
        self.assertIn("inputs.commit_sha || github.sha", pages_text)
        revision_step = pages_workflow["jobs"]["validate"]["steps"][1]
        self.assertIn('test "$(git rev-parse HEAD)"', revision_step["run"])

    def test_commit_continues_when_optional_disaster_job_fails(self) -> None:
        workflow_path = (
            Path(__file__).parents[1] / ".github" / "workflows" / "sync-states.yml"
        )
        jobs = yaml.safe_load(workflow_path.read_text(encoding="utf-8"))["jobs"]
        prepare_condition = jobs["prepare-publication"]["if"]
        commit_condition = jobs["commit-data"]["if"]

        self.assertIn("always()", prepare_condition)
        self.assertIn("needs.sync-sentinel.result == 'success'", prepare_condition)
        self.assertNotIn("needs.sync-disaster.result == 'success'", prepare_condition)
        self.assertIn("always()", commit_condition)
        self.assertNotIn("needs.sync-disaster.result == 'success'", commit_condition)

    def test_sync_workflow_accepts_sentinel_repository_dispatch(self) -> None:
        workflow_path = (
            Path(__file__).parents[1] / ".github" / "workflows" / "sync-states.yml"
        )
        text = workflow_path.read_text(encoding="utf-8")
        jobs = yaml.safe_load(text)["jobs"]
        gate_script = jobs["gate"]["steps"][0]["run"]

        self.assertIn("repository_dispatch", text)
        self.assertIn("sentinel-publication-updated", text)
        self.assertIn('"$event_name" == "repository_dispatch"', gate_script)

    def test_dispatch_is_pinned_and_all_data_writers_are_serialized(self) -> None:
        workflows = Path(__file__).parents[1] / ".github" / "workflows"
        sync_text = (workflows / "sync-states.yml").read_text(encoding="utf-8")
        sync = yaml.safe_load(sync_text)
        sentinel_job = json.dumps(sync["jobs"]["sync-sentinel"])
        commit_job = json.dumps(sync["jobs"]["commit-data"])

        self.assertIn("github.event.client_payload.source_commit", sentinel_job)
        self.assertIn("repository dispatch metadata mismatch", sentinel_job)
        self.assertIn("older than origin/main", commit_job)
        for filename in (
            "sync-states.yml",
            "sync-ai-cyber-digest.yml",
            "sync-ews.yml",
        ):
            workflow = yaml.safe_load(
                (workflows / filename).read_text(encoding="utf-8")
            )
            self.assertEqual(
                workflow["concurrency"]["group"],
                "website-data-updates",
            )

    def test_production_gate_runs_browser_marker_verification(self) -> None:
        workflow_path = (
            Path(__file__).parents[1] / ".github" / "workflows" / "sync-states.yml"
        )
        workflow = yaml.safe_load(workflow_path.read_text(encoding="utf-8"))
        verification = json.dumps(workflow["jobs"]["verify-production"])
        browser_test = (
            Path(__file__).with_name("verify_global_map_browser.js").read_text(
                encoding="utf-8"
            )
        )

        self.assertIn("playwright@1.62.0", verification)
        self.assertIn("verify_global_map_browser.js", verification)
        self.assertIn("dataset.renderedFeatures", browser_test)
        self.assertIn("EXPECTED_PUBLICATION_ID", browser_test)
        self.assertIn("#ops-generated", browser_test)

    def test_workflow_reports_end_to_end_publication_telemetry(self) -> None:
        workflow_path = (
            Path(__file__).parents[1] / ".github" / "workflows" / "sync-states.yml"
        )
        workflow = yaml.safe_load(workflow_path.read_text(encoding="utf-8"))
        summary = json.dumps(workflow["jobs"]["publication-summary"])

        for field in (
            "PUBLICATION_ID",
            "MAP_EVENT_COUNT",
            "WEBSITE_COMMIT",
            "PREVIOUS_PRODUCTION_ID",
            "DEPLOY_RESULT",
            "VERIFY_RESULT",
        ):
            self.assertIn(field, summary)
        self.assertIn("GITHUB_STEP_SUMMARY", summary)

    def test_sentinel_artifact_preserves_source_manifest_layout_between_jobs(
        self,
    ) -> None:
        workflow_path = (
            Path(__file__).parents[1] / ".github" / "workflows" / "sync-states.yml"
        )
        jobs = yaml.safe_load(workflow_path.read_text(encoding="utf-8"))["jobs"]
        sentinel = jobs["sync-sentinel"]
        prepare = jobs["prepare-publication"]
        commit = jobs["commit-data"]

        sentinel_upload = next(
            step
            for step in sentinel["steps"]
            if step.get("name") == "Upload validated Sentinel publication"
        )
        prepared_upload = next(
            step
            for step in prepare["steps"]
            if step.get("name") == "Upload prepared publication"
        )
        apply_step = next(
            step
            for step in commit["steps"]
            if step.get("name") == "Apply validated source publications"
        )
        self.assertEqual(
            sentinel_upload["with"]["path"],
            "external/sentinel/data/output",
        )
        self.assertEqual(prepared_upload["with"]["path"], "candidate")
        self.assertIn("--source-root prepared/sentinel", apply_step["run"])


if __name__ == "__main__":
    unittest.main()

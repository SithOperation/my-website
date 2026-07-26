"""Executable failure-boundary tests for transactional X output publication."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

import main as x_main
from storage import x_output_transaction as transaction

OLD_GENERATION = "generation-old"
NEW_GENERATION = "generation-new"
GENERATED_AT = "2026-07-26T16:45:01Z"


def metadata(generation_id: str) -> dict[str, str]:
    """Return deterministic generation metadata for tests."""

    return {
        "schema_version": "1.0",
        "generation_id": generation_id,
        "generated_at": GENERATED_AT,
    }


def empty_documents(
    generation_id: str,
) -> tuple[dict[str, object], dict[str, object]]:
    """Build a valid empty output pair."""

    return (
        {**metadata(generation_id), "events": []},
        {
            "type": "FeatureCollection",
            **metadata(generation_id),
            "features": [],
        },
    )


def write_pair(output_dir: Path, generation_id: str) -> tuple[bytes, bytes]:
    """Write a deterministic visible output pair and return its bytes."""

    output_dir.mkdir(parents=True, exist_ok=True)
    event_document, geojson_document = empty_documents(generation_id)
    event_bytes = transaction.serialize_document(event_document)
    geojson_bytes = transaction.serialize_document(geojson_document)
    (output_dir / transaction.EVENT_FILENAME).write_bytes(event_bytes)
    (output_dir / transaction.GEOJSON_FILENAME).write_bytes(geojson_bytes)
    return event_bytes, geojson_bytes


def assert_no_transaction_files(test: unittest.TestCase, output_dir: Path) -> None:
    """Assert that handled publication paths leave no staging or backups."""

    remaining = sorted(path.name for path in output_dir.glob(".x_report_*"))
    test.assertEqual(remaining, [])


class XOutputTransactionTests(unittest.TestCase):
    """Exercise every coordinated publication boundary with real files."""

    def assert_old_pair(
        self,
        output_dir: Path,
        old_bytes: tuple[bytes, bytes],
    ) -> None:
        """Assert both canonical files retain the exact prior bytes."""

        self.assertEqual(
            (output_dir / transaction.EVENT_FILENAME).read_bytes(),
            old_bytes[0],
        )
        self.assertEqual(
            (output_dir / transaction.GEOJSON_FILENAME).read_bytes(),
            old_bytes[1],
        )

    def test_successful_publication_installs_one_generation(self) -> None:
        """A complete validated pair is durably published together."""

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            write_pair(output_dir, OLD_GENERATION)
            events, geojson = empty_documents(NEW_GENERATION)

            transaction.publish_output_pair(
                output_dir,
                events,
                geojson,
                expected_report_count=0,
            )

            installed_events = json.loads(
                (output_dir / transaction.EVENT_FILENAME).read_text(encoding="utf-8")
            )
            installed_geojson = json.loads(
                (output_dir / transaction.GEOJSON_FILENAME).read_text(encoding="utf-8")
            )
            self.assertEqual(
                installed_events["generation_id"],
                installed_geojson["generation_id"],
            )
            self.assertEqual(
                installed_events["generated_at"],
                installed_geojson["generated_at"],
            )
            self.assertEqual(installed_events["events"], [])
            self.assertEqual(installed_geojson["features"], [])
            assert_no_transaction_files(self, output_dir)

    def test_validation_failure_preserves_previous_pair(self) -> None:
        """Invalid generated output is rejected before any staging."""

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            old_bytes = write_pair(output_dir, OLD_GENERATION)
            events, geojson = empty_documents(NEW_GENERATION)
            geojson["type"] = "Invalid"

            with self.assertRaises(transaction.OutputValidationError):
                transaction.publish_output_pair(
                    output_dir,
                    events,
                    geojson,
                    expected_report_count=0,
                )

            self.assert_old_pair(output_dir, old_bytes)
            assert_no_transaction_files(self, output_dir)

    def test_nonfinite_serialization_preserves_previous_pair(self) -> None:
        """NaN is rejected before either production file is touched."""

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            old_bytes = write_pair(output_dir, OLD_GENERATION)
            events, geojson = empty_documents(NEW_GENERATION)
            events["unexpected"] = float("nan")

            with self.assertRaises(transaction.OutputValidationError):
                transaction.publish_output_pair(
                    output_dir,
                    events,
                    geojson,
                    expected_report_count=0,
                )

            self.assert_old_pair(output_dir, old_bytes)

    def test_event_and_geojson_serialization_failures_preserve_pair(self) -> None:
        """Failure serializing either complete document touches no final file."""

        for failing_kind in ("events", "geojson"):
            with self.subTest(document=failing_kind):
                with tempfile.TemporaryDirectory() as directory:
                    output_dir = Path(directory)
                    old_bytes = write_pair(output_dir, OLD_GENERATION)
                    events, geojson = empty_documents(NEW_GENERATION)
                    calls = 0

                    def failing_serializer(document: object) -> bytes:
                        nonlocal calls
                        calls += 1
                        expected_call = 1 if failing_kind == "events" else 2
                        if calls == expected_call:
                            raise TypeError(f"injected {failing_kind} serialization")
                        return transaction.serialize_document(document)

                    with self.assertRaises(TypeError):
                        transaction.publish_output_pair(
                            output_dir,
                            events,
                            geojson,
                            expected_report_count=0,
                            serializer=failing_serializer,
                        )

                    self.assert_old_pair(output_dir, old_bytes)
                    assert_no_transaction_files(self, output_dir)

    def test_each_generation_stage_failure_preserves_previous_pair(self) -> None:
        """Event and GeoJSON write/fsync failures leave the old pair intact."""

        for failure_call in (1, 2, 3, 4):
            with self.subTest(write_call=failure_call):
                with tempfile.TemporaryDirectory() as directory:
                    output_dir = Path(directory)
                    old_bytes = write_pair(output_dir, OLD_GENERATION)
                    events, geojson = empty_documents(NEW_GENERATION)
                    real_write = transaction._write_durable
                    calls = 0

                    def failing_write(path: Path, payload: bytes) -> None:
                        nonlocal calls
                        calls += 1
                        if calls == failure_call:
                            raise OSError("injected disk or fsync failure")
                        real_write(path, payload)

                    with (
                        patch.object(
                            transaction,
                            "_write_durable",
                            side_effect=failing_write,
                        ),
                        self.assertRaises(transaction.OutputStagingError),
                    ):
                        transaction.publish_output_pair(
                            output_dir,
                            events,
                            geojson,
                            expected_report_count=0,
                        )

                    self.assert_old_pair(output_dir, old_bytes)
                    assert_no_transaction_files(self, output_dir)

    def test_each_replacement_failure_rolls_back_exact_bytes(self) -> None:
        """Failure at either replacement restores both previous files."""

        for failure_call in (1, 2):
            with self.subTest(replace_call=failure_call):
                with tempfile.TemporaryDirectory() as directory:
                    output_dir = Path(directory)
                    old_bytes = write_pair(output_dir, OLD_GENERATION)
                    events, geojson = empty_documents(NEW_GENERATION)
                    calls = 0

                    def failing_replace(source: str | Path, target: str | Path) -> None:
                        nonlocal calls
                        calls += 1
                        if calls == failure_call:
                            raise OSError("injected replacement failure")
                        os.replace(source, target)

                    with self.assertRaises(transaction.OutputPublicationError):
                        transaction.publish_output_pair(
                            output_dir,
                            events,
                            geojson,
                            expected_report_count=0,
                            replace=failing_replace,
                        )

                    self.assert_old_pair(output_dir, old_bytes)
                    assert_no_transaction_files(self, output_dir)

    def test_installed_validation_failure_rolls_back(self) -> None:
        """Post-install validation failure restores the exact old generation."""

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            old_bytes = write_pair(output_dir, OLD_GENERATION)
            events, geojson = empty_documents(NEW_GENERATION)
            real_validate = transaction.validate_output_pair
            calls = 0

            def failing_validation(
                event_document: object,
                geojson_document: object,
                *,
                expected_report_count: int,
            ) -> None:
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise transaction.OutputValidationError(
                        "injected installed validation failure"
                    )
                real_validate(
                    event_document,
                    geojson_document,
                    expected_report_count=expected_report_count,
                )

            with (
                patch.object(
                    transaction,
                    "validate_output_pair",
                    side_effect=failing_validation,
                ),
                self.assertRaises(transaction.OutputPublicationError),
            ):
                transaction.publish_output_pair(
                    output_dir,
                    events,
                    geojson,
                    expected_report_count=0,
                )

            self.assert_old_pair(output_dir, old_bytes)
            assert_no_transaction_files(self, output_dir)

    def test_rollback_failure_is_critical_and_retains_recovery_backup(self) -> None:
        """A failed rollback raises its distinct critical exception."""

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            write_pair(output_dir, OLD_GENERATION)
            events, geojson = empty_documents(NEW_GENERATION)
            calls = 0

            def failing_replace(source: str | Path, target: str | Path) -> None:
                nonlocal calls
                calls += 1
                if calls in {2, 3}:
                    raise OSError("injected publication/rollback failure")
                os.replace(source, target)

            with self.assertRaises(transaction.OutputRollbackError):
                transaction.publish_output_pair(
                    output_dir,
                    events,
                    geojson,
                    expected_report_count=0,
                    replace=failing_replace,
                )

            self.assertTrue(
                any(output_dir.glob(".x_report_*.bak")),
                "recovery backup should remain after critical rollback failure",
            )

    def test_empty_generation_removes_old_visible_content(self) -> None:
        """A valid empty generation replaces prior nonempty canonical files."""

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            (output_dir / transaction.EVENT_FILENAME).write_text(
                '{"generation_id":"old","events":[{"id":"stale"}]}',
                encoding="utf-8",
            )
            (output_dir / transaction.GEOJSON_FILENAME).write_text(
                '{"generation_id":"old","features":[{"id":"stale"}]}',
                encoding="utf-8",
            )
            events, geojson = empty_documents(NEW_GENERATION)

            transaction.publish_output_pair(
                output_dir,
                events,
                geojson,
                expected_report_count=0,
            )

            installed_events = json.loads(
                (output_dir / transaction.EVENT_FILENAME).read_text(encoding="utf-8")
            )
            installed_geojson = json.loads(
                (output_dir / transaction.GEOJSON_FILENAME).read_text(encoding="utf-8")
            )
            self.assertEqual(installed_events["events"], [])
            self.assertEqual(installed_geojson["features"], [])
            self.assertNotIn("stale", json.dumps(installed_events))
            self.assertNotIn("stale", json.dumps(installed_geojson))

    def test_stale_temporary_file_is_removed_before_publication(self) -> None:
        """Abandoned staging files cannot survive a handled transaction."""

        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            write_pair(output_dir, OLD_GENERATION)
            (output_dir / ".x_report_abandoned.tmp").write_text(
                "stale",
                encoding="utf-8",
            )
            events, geojson = empty_documents(NEW_GENERATION)

            transaction.publish_output_pair(
                output_dir,
                events,
                geojson,
                expected_report_count=0,
            )

            assert_no_transaction_files(self, output_dir)

    def test_generation_failures_do_not_touch_existing_files(self) -> None:
        """Normalization, correlation, and GeoJSON failures precede publication."""

        for patch_target in (
            "main.normalize_reports",
            "main.correlate_reports",
            "main.build_report_geojson",
        ):
            with self.subTest(target=patch_target):
                with tempfile.TemporaryDirectory() as directory:
                    root = Path(directory)
                    output_dir = root / "output"
                    old_bytes = write_pair(output_dir, OLD_GENERATION)
                    source = root / "x_sources.json"
                    source.write_text(
                        '{"schema_version":"1.0","reports":[]}',
                        encoding="utf-8",
                    )
                    with (
                        patch(patch_target, side_effect=ValueError("injected")),
                        self.assertRaises(ValueError),
                    ):
                        x_main.build_x_report_layer(source, output_dir)
                    self.assert_old_pair(output_dir, old_bytes)

    def test_cli_exit_codes_distinguish_critical_rollback(self) -> None:
        """CLI returns 0, 1, or 2 for success, failure, or rollback failure."""

        with patch("main.build_x_report_layer", return_value=([], {})):
            self.assertEqual(x_main.main(), 0)
        for failure in (
            ValueError("generation failed"),
            transaction.OutputValidationError("validation failed"),
            transaction.OutputStagingError("staging failed"),
            transaction.OutputPublicationError("publication failed"),
        ):
            with self.subTest(error=type(failure).__name__):
                with patch("main.build_x_report_layer", side_effect=failure):
                    self.assertEqual(x_main.main(), 1)
        with patch(
            "main.build_x_report_layer",
            side_effect=transaction.OutputRollbackError("critical"),
        ):
            self.assertEqual(x_main.main(), 2)

    def test_generation_metadata_is_shared_and_well_formed(self) -> None:
        """Generated identity uses the documented timestamp-plus-suffix format."""

        value = transaction.create_generation_metadata(
            now=datetime(2026, 7, 26, 16, 45, 1, tzinfo=UTC)
        )
        self.assertRegex(
            value["generation_id"],
            r"^20260726T164501Z-[0-9a-f]{8}$",
        )
        self.assertEqual(value["generated_at"], GENERATED_AT)


if __name__ == "__main__":
    unittest.main()

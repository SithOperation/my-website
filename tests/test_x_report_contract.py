"""Cross-repository contract tests for versioned X report documents."""

from __future__ import annotations

import copy
import json
import unittest
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from models.x_report_contract import validate_document

FIXTURES = Path(__file__).parent / "fixtures"
REFERENCE_TIME = datetime(2026, 7, 26, 14, 10, tzinfo=UTC)


def load_fixture(name: str) -> dict[str, Any]:
    """Load a contract fixture from the repository test suite."""

    value = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AssertionError(f"{name} must contain an object")
    return value


class XReportContractTests(unittest.TestCase):
    """Assert strict validation behavior shared by producer and consumer."""

    def valid_document(self) -> dict[str, Any]:
        """Return a fresh copy of the valid shared fixture."""

        return copy.deepcopy(load_fixture("x_sources_valid.json"))

    def test_shared_valid_fixture_passes(self) -> None:
        """The canonical valid fixture satisfies schema version 1.0."""

        validate_document(self.valid_document(), now=REFERENCE_TIME)

    def test_shared_invalid_fixture_fails_for_documented_reason(self) -> None:
        """The canonical invalid fixture fails with the same precise reason."""

        fixture = load_fixture("x_sources_invalid.json")
        with self.assertRaisesRegex(
            ValueError,
            str(fixture["expected_error"]).replace("[", r"\[").replace("]", r"\]"),
        ):
            validate_document(fixture["document"], now=REFERENCE_TIME)

    def test_strict_field_validation(self) -> None:
        """Types, enums, timezones, ranges, and URLs are never coerced."""

        cases: list[tuple[str, str, object, str]] = [
            ("account", "account", "@bad", "normalized X handle"),
            ("source URL", "source_url", "https://twitter.com/a/status/1", "canonical"),
            ("naive time", "published_at", "2026-07-26T14:00:00", "timezone"),
            ("future time", "published_at", "2026-07-27T14:00:00Z", "future"),
            ("expired time", "published_at", "2026-07-23T14:00:00Z", "retention"),
            ("string latitude", "latitude", "42.3", "finite number"),
            ("infinite longitude", "longitude", float("inf"), "finite number"),
            ("latitude range", "latitude", 91, "between -90 and 90"),
            ("longitude range", "longitude", -181, "between -180 and 180"),
            ("confidence type", "confidence", "0.5", "finite number"),
            ("confidence range", "confidence", 1.1, "between 0 and 1"),
            ("event enum", "event_type", "other", "unsupported"),
            ("source enum", "source_class", "official_military", "unsupported"),
            ("verification enum", "verification_status", "unknown", "unsupported"),
            ("precision enum", "location_precision", "neighborhood", "unsupported"),
            ("quoted URL", "quoted_url", "https://example.com/post", "canonical"),
            ("reposted URL", "reposted_url", "https://x.com/a", "canonical"),
        ]
        for name, field, value, error in cases:
            with self.subTest(name=name):
                document = self.valid_document()
                document["reports"][0][field] = value
                with self.assertRaisesRegex(ValueError, error):
                    validate_document(document, now=REFERENCE_TIME)

    def test_duplicate_status_ids_and_urls_are_rejected(self) -> None:
        """A document cannot publish duplicate identities or canonical URLs."""

        for duplicate_field in ("status_id", "source_url"):
            with self.subTest(field=duplicate_field):
                document = self.valid_document()
                second = copy.deepcopy(document["reports"][0])
                second["account"] = "MonitorX99800"
                second["status_id"] = "1999999999999999999"
                second["source_url"] = (
                    "https://x.com/MonitorX99800/status/1999999999999999999"
                )
                second[duplicate_field] = document["reports"][0][duplicate_field]
                document["reports"].append(second)
                with self.assertRaisesRegex(ValueError, "duplicated|must match"):
                    validate_document(document, now=REFERENCE_TIME)

    def test_source_url_account_must_match_report_account(self) -> None:
        document = self.valid_document()
        document["reports"][0]["account"] = "OtherAccount"
        with self.assertRaisesRegex(ValueError, "must match account"):
            validate_document(document, now=REFERENCE_TIME)


if __name__ == "__main__":
    unittest.main()

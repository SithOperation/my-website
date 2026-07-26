"""Website generator CLI exit-code tests."""

from __future__ import annotations

from unittest.mock import patch

import main
from storage.x_output_transaction import OutputRollbackError


def test_generation_failure_returns_nonzero() -> None:
    """A generation exception cannot produce a successful workflow exit."""
    with patch.object(main, "build_x_report_layer", side_effect=ValueError("invalid")):
        assert main.main() == 1


def test_rollback_failure_returns_critical_exit_code() -> None:
    """A failed rollback remains distinguishable from ordinary failure."""
    with patch.object(
        main,
        "build_x_report_layer",
        side_effect=OutputRollbackError("critical"),
    ):
        assert main.main() == 2

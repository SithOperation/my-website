"""Tests for the GitHub Pages staging and validation utility."""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path
from types import ModuleType


def load_stage_module() -> ModuleType:
    """Load the hyphenated staging script as an importable module."""

    script = Path(__file__).parents[1] / "scripts" / "stage-pages.py"
    specification = importlib.util.spec_from_file_location("stage_pages", script)
    if specification is None or specification.loader is None:
        raise RuntimeError(f"Unable to load {script}")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


STAGE_PAGES = load_stage_module()


class StagePagesTests(unittest.TestCase):
    """Verify deployment staging uses an explicit safe allowlist."""

    def create_public_repository(self, root: Path) -> None:
        """Create the minimum public repository shape used by the builder."""

        for directory in STAGE_PAGES.PUBLIC_DIRECTORIES:
            target = root / directory
            target.mkdir(parents=True)
            (target / "public.txt").write_text("public", encoding="utf-8")
        for filename in STAGE_PAGES.PUBLIC_FILES:
            target = root / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("public", encoding="utf-8")

    def test_stage_includes_public_content_and_excludes_repository_internals(
        self,
    ) -> None:
        """Only allowlisted website content reaches the staged artifact."""

        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            self.create_public_repository(repository)
            (repository / "main.py").write_text("private", encoding="utf-8")
            (repository / "tests").mkdir()
            (repository / "tests" / "test_app.py").write_text(
                "private", encoding="utf-8"
            )
            hdr = repository / "assets" / "hdr"
            hdr.mkdir()
            (hdr / "optional.exr").write_bytes(b"source quality")
            stage = repository / "_site"

            STAGE_PAGES.stage_pages(repository, stage)

            self.assertTrue((stage / "index.html").is_file())
            self.assertTrue((stage / "assets" / "public.txt").is_file())
            self.assertFalse((stage / "main.py").exists())
            self.assertFalse((stage / "tests").exists())
            self.assertFalse((stage / "assets" / "hdr").exists())

    def test_verification_rejects_browser_profile_data(self) -> None:
        """Browser profiles cause deployment validation to fail."""

        with tempfile.TemporaryDirectory() as temporary_directory:
            stage = Path(temporary_directory)
            profile = stage / "output" / "edge-check-profile" / "Default"
            profile.mkdir(parents=True)
            (profile / "Cookies").write_bytes(b"not public")

            with self.assertRaises(STAGE_PAGES.DeploymentValidationError):
                STAGE_PAGES.verify_stage(stage)

    def test_verification_rejects_transaction_backups(self) -> None:
        """Incomplete X output transactions cannot enter the Pages artifact."""

        with tempfile.TemporaryDirectory() as temporary_directory:
            stage = Path(temporary_directory)
            output = stage / "data" / "output"
            output.mkdir(parents=True)
            (output / ".x_report_events.generation.bak").write_bytes(b"backup")

            with self.assertRaises(STAGE_PAGES.DeploymentValidationError):
                STAGE_PAGES.verify_stage(stage)

    def test_failed_copy_removes_partial_stage(self) -> None:
        """A missing required public path leaves no partial artifact."""

        with tempfile.TemporaryDirectory() as temporary_directory:
            repository = Path(temporary_directory)
            self.create_public_repository(repository)
            (repository / STAGE_PAGES.PUBLIC_FILES[0]).unlink()
            stage = repository / "_site"

            with self.assertRaises(STAGE_PAGES.DeploymentValidationError):
                STAGE_PAGES.stage_pages(repository, stage)

            self.assertFalse(stage.exists())


if __name__ == "__main__":
    unittest.main()

"""Malicious-path tests for governance archive extraction."""

from __future__ import annotations

import importlib.util
from pathlib import Path, PurePosixPath
from types import ModuleType

import pytest


def load_builder() -> ModuleType:
    """Load the hyphenated workflow script as a testable module."""
    path = Path("scripts/build-governance-library.py").resolve()
    spec = importlib.util.spec_from_file_location("governance_builder", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    "source_id",
    [
        "../escape",
        r"..\escape",
        "/absolute",
        r"C:\escape",
        r"\\server\share",
        "encoded%2f..%2fescape",
        "two..dots",
    ],
)
def test_rejects_malicious_source_ids(source_id: str) -> None:
    """Manifest identifiers cannot control extraction destinations."""
    with pytest.raises(ValueError, match="Unsafe source_id"):
        load_builder().validate_source_id(source_id)


@pytest.mark.parametrize(
    "member",
    [
        "base/../escape",
        r"base\..\escape",
        "base/%2e%2e/escape",
        "base/%252e%252e/escape",
        "/base/absolute",
        r"C:\base\escape",
        r"\\server\share",
    ],
)
def test_rejects_archive_traversal_variants(member: str) -> None:
    """Decoded, mixed-slash, absolute, drive, and UNC paths fail."""
    with pytest.raises(ValueError):
        load_builder().safe_archive_relative(member, "base/")


def test_destination_rejects_symlink_escape(tmp_path: Path) -> None:
    """Resolved destinations cannot traverse an existing directory symlink."""
    module = load_builder()
    root = tmp_path / "root"
    outside = tmp_path / "outside"
    root.mkdir()
    outside.mkdir()
    link = root / "link"
    try:
        link.symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("directory symlinks are unavailable")
    with pytest.raises(ValueError, match="escapes|symlink"):
        module.safe_destination(root, PurePosixPath("link/file.txt"))


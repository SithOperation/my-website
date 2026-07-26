"""Build and verify the allowlisted GitHub Pages deployment directory."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

PUBLIC_DIRECTORIES = (
    ".well-known",
    "assets",
    "data",
    "governance-library",
    "resources",
)
PUBLIC_FILES = (
    ".nojekyll",
    "CNAME",
    "favicon.ico",
    "index.html",
    "robots.txt",
    "sentinel.html",
    "site.webmanifest",
    "style.css",
    "url-inspector.html",
)
FORBIDDEN_DIRECTORY_NAMES = frozenset(
    {
        ".git",
        ".github",
        ".pytest_cache",
        ".venv",
        "__pycache__",
        "browser-profile",
        "edge-check-profile",
        "logs",
        "node_modules",
        "tests",
        "user-data-dir",
    }
)
FORBIDDEN_FILE_SUFFIXES = frozenset(
    {
        ".db",
        ".log",
        ".py",
        ".pyc",
        ".pyd",
        ".pyo",
        ".sqlite",
        ".sqlite3",
        ".tmp",
        ".yaml",
        ".yml",
    }
)
FORBIDDEN_FILE_NAMES = frozenset(
    {
        "cookies",
        "history",
        "login data",
        "local state",
        "web data",
    }
)


class DeploymentValidationError(RuntimeError):
    """Raised when the staged Pages artifact contains forbidden content."""


def _is_relative_to(path: Path, parent: Path) -> bool:
    """Return whether *path* is located beneath *parent*."""

    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def _copy_public_path(source: Path, destination: Path) -> None:
    """Copy one allowlisted public path without following symbolic links."""

    if source.is_symlink():
        raise DeploymentValidationError(f"Public path may not be a symlink: {source}")
    if source.is_dir():
        shutil.copytree(source, destination, copy_function=shutil.copy2)
        return
    if source.is_file():
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        return
    raise DeploymentValidationError(f"Required public path is missing: {source}")


def find_forbidden_paths(stage_directory: Path) -> list[Path]:
    """Return sorted forbidden paths found in a staged Pages artifact."""

    forbidden: list[Path] = []
    for path in stage_directory.rglob("*"):
        relative = path.relative_to(stage_directory)
        lowered_parts = {part.casefold() for part in relative.parts}
        if lowered_parts & FORBIDDEN_DIRECTORY_NAMES:
            forbidden.append(relative)
            continue
        if path.is_symlink():
            forbidden.append(relative)
            continue
        if path.is_file() and (
            path.name.casefold() in FORBIDDEN_FILE_NAMES
            or path.suffix.casefold() in FORBIDDEN_FILE_SUFFIXES
        ):
            forbidden.append(relative)
    return sorted(set(forbidden), key=lambda item: item.as_posix())


def verify_stage(stage_directory: Path) -> None:
    """Validate that a Pages artifact contains only deployable content."""

    if not stage_directory.is_dir():
        raise DeploymentValidationError(
            f"Pages staging directory does not exist: {stage_directory}"
        )
    forbidden = find_forbidden_paths(stage_directory)
    if forbidden:
        formatted = "\n".join(f"  - {path.as_posix()}" for path in forbidden)
        raise DeploymentValidationError(
            f"Forbidden content found in Pages artifact:\n{formatted}"
        )


def stage_pages(repository: Path, stage_directory: Path) -> None:
    """Create and validate a clean, allowlisted Pages artifact."""

    repository = repository.resolve()
    stage_directory = stage_directory.resolve()
    if repository == stage_directory or not _is_relative_to(
        stage_directory, repository
    ):
        raise DeploymentValidationError(
            "The staging directory must be a child of the repository"
        )

    if stage_directory.exists():
        shutil.rmtree(stage_directory)
    stage_directory.mkdir(parents=True)

    try:
        for relative_path in (*PUBLIC_DIRECTORIES, *PUBLIC_FILES):
            _copy_public_path(
                repository / relative_path,
                stage_directory / relative_path,
            )
        verify_stage(stage_directory)
    except Exception:
        shutil.rmtree(stage_directory, ignore_errors=True)
        raise


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""

    parser = argparse.ArgumentParser(
        description="Build or verify the GitHub Pages staging directory."
    )
    parser.add_argument(
        "--repository",
        type=Path,
        default=Path.cwd(),
        help="Website repository root (default: current directory).",
    )
    parser.add_argument(
        "--stage",
        type=Path,
        default=Path("_site"),
        help="Staging directory, relative to the repository by default.",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Verify an existing staging directory without rebuilding it.",
    )
    return parser.parse_args()


def main() -> int:
    """Build or verify the Pages artifact and return a process exit code."""

    args = parse_args()
    repository = args.repository.resolve()
    stage_directory = args.stage
    if not stage_directory.is_absolute():
        stage_directory = repository / stage_directory

    try:
        if args.verify_only:
            verify_stage(stage_directory.resolve())
        else:
            stage_pages(repository, stage_directory)
    except (DeploymentValidationError, OSError) as error:
        print(f"Pages artifact validation failed: {error}")
        return 1

    print(f"Pages artifact verified: {stage_directory.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

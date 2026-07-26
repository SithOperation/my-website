"""Prepare and complete one immutable X source website synchronization."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from scheduling.x_source_sync import (  # noqa: E402
    ConsumerState,
    DispatchPayload,
    atomic_write_json,
    read_json,
    validate_source,
)


def output(name: str, value: str) -> None:
    """Emit a GitHub step output when configured."""
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with Path(path).open("a", encoding="utf-8") as stream:
            stream.write(f"{name}={value}\n")
    print(f"{name}={value}")


def payload_from_file(path: Path) -> DispatchPayload:
    """Parse a dispatch payload JSON file."""
    return DispatchPayload.parse(read_json(path))


def prepare(root: Path, payload_path: Path) -> bool:
    """Validate and atomically publish an eligible producer feed."""
    payload = payload_from_file(payload_path)
    state = ConsumerState(root / "data" / "x_source_sync_state.json")
    if not state.should_process(payload):
        output("process", "false")
        output("outcome", "already_completed")
        return False
    source_root = root / "external" / "x-sources"
    feed = validate_source(
        payload,
        source_root / "output" / "x_sources_manifest.json",
        source_root / "output" / "x_sources.json",
    )
    atomic_write_json(root / "data" / "x_sources.json", feed)
    output("process", "true")
    output("outcome", "prepared")
    return True


def complete(root: Path, payload_path: Path) -> None:
    """Persist completion after the website output pair exists."""
    payload = payload_from_file(payload_path)
    geojson = read_json(root / "data" / "output" / "x_report_pinpoints.geojson")
    if not isinstance(geojson, dict) or not isinstance(
        geojson.get("generation_id"), str
    ):
        raise ValueError("generated GeoJSON is missing generation_id")
    ConsumerState(root / "data" / "x_source_sync_state.json").complete(
        payload, geojson["generation_id"]
    )


def main() -> int:
    """Run the requested workflow coordination command."""
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("prepare", "complete"))
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--payload", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "prepare":
        prepare(args.root.resolve(), args.payload.resolve())
    else:
        complete(args.root.resolve(), args.payload.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

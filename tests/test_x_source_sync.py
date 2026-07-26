"""Tests for immutable event-driven X source synchronization."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scheduling.x_source_sync import (
    ConsumerState,
    DispatchPayload,
    validate_source,
)

SHA = "a" * 40


def payload(**changes: object) -> DispatchPayload:
    """Build a valid dispatch payload with selected changes."""
    value: dict[str, object] = {
        "slot_id": "2026-07-15-morning",
        "generation_id": "generation-1",
        "schema_version": "1.0",
        "source_commit_sha": SHA,
        "report_count": 0,
        "completed_at": "2026-07-15T12:00:00Z",
        "force": False,
    }
    value.update(changes)
    return DispatchPayload.parse(value)


def write_json(path: Path, value: object) -> None:
    """Write a test JSON document."""
    path.write_text(json.dumps(value), encoding="utf-8")


def test_payload_requires_exact_commit_sha() -> None:
    """Moving branches and abbreviated SHAs are rejected."""
    with pytest.raises(ValueError, match="full lowercase"):
        payload(source_commit_sha="main")


def test_manifest_and_empty_feed_match_dispatch(tmp_path: Path) -> None:
    """A matching zero-report generation validates."""
    request = payload()
    manifest = {
        "manifest_schema_version": "1.0",
        "slot_id": request.slot_id,
        "generation_id": request.generation_id,
        "schema_version": request.schema_version,
        "completed_at": request.completed_at,
        "report_count": 0,
        "collection_status": "success",
    }
    write_json(tmp_path / "manifest.json", manifest)
    write_json(
        tmp_path / "feed.json", {"schema_version": "1.0", "reports": []}
    )
    validate_source(request, tmp_path / "manifest.json", tmp_path / "feed.json")


def test_manifest_mismatch_fails_closed(tmp_path: Path) -> None:
    """A dispatch cannot authorize a different producer generation."""
    request = payload()
    write_json(tmp_path / "manifest.json", {"generation_id": "other"})
    write_json(
        tmp_path / "feed.json", {"schema_version": "1.0", "reports": []}
    )
    with pytest.raises(ValueError, match="does not match"):
        validate_source(request, tmp_path / "manifest.json", tmp_path / "feed.json")


def test_consumer_replay_and_conflict_policy(tmp_path: Path) -> None:
    """Exact replays skip and conflicts require an explicit force."""
    state = ConsumerState(tmp_path / "state.json")
    first = payload()
    state.complete(first, "website-generation")
    assert not state.should_process(first)
    with pytest.raises(ValueError, match="different generation"):
        state.should_process(payload(generation_id="generation-2"))
    assert state.should_process(payload(generation_id="generation-2", force=True))


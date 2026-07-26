"""Validate immutable producer dispatches and track consumed generations."""

from __future__ import annotations

import json
import os
import re
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

from models.x_report_contract import validate_document

_SHA = re.compile(r"^[0-9a-f]{40}$")
_SLOT = re.compile(r"^\d{4}-\d{2}-\d{2}-(morning|evening)$")


@dataclass(frozen=True, slots=True)
class DispatchPayload:
    """Strict metadata received from a successful producer push."""

    slot_id: str
    generation_id: str
    schema_version: str
    source_commit_sha: str
    report_count: int
    completed_at: str
    force: bool = False

    @classmethod
    def parse(cls, value: object) -> DispatchPayload:
        """Validate a repository-dispatch client payload."""
        if not isinstance(value, dict):
            raise ValueError("dispatch payload must be an object")
        required = {
            "slot_id",
            "generation_id",
            "schema_version",
            "source_commit_sha",
            "report_count",
            "completed_at",
        }
        if not required <= set(value) or set(value) - required - {"force"}:
            raise ValueError("dispatch payload has an unexpected shape")
        strings = required - {"report_count"}
        if not all(isinstance(value[key], str) and value[key] for key in strings):
            raise ValueError("dispatch string fields must be non-empty")
        if _SLOT.fullmatch(value["slot_id"]) is None:
            raise ValueError("slot_id must identify a Detroit morning or evening")
        if _SHA.fullmatch(value["source_commit_sha"]) is None:
            raise ValueError("source_commit_sha must be a full lowercase Git SHA")
        count = value["report_count"]
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            raise ValueError("report_count must be a non-negative integer")
        try:
            completed = datetime.fromisoformat(
                value["completed_at"].replace("Z", "+00:00")
            )
        except ValueError as error:
            raise ValueError("completed_at must be ISO 8601") from error
        if completed.tzinfo is None or completed.utcoffset() is None:
            raise ValueError("completed_at must include a timezone")
        force = value.get("force", False)
        if not isinstance(force, bool):
            raise ValueError("force must be Boolean")
        return cls(**{**value, "force": force})


def read_json(path: Path) -> object:
    """Read a UTF-8 JSON document."""
    with path.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def atomic_write_json(path: Path, value: object) -> None:
    """Atomically replace a JSON file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


class ConsumerState:
    """Persist successfully published website generations."""

    def __init__(self, path: Path) -> None:
        """Initialize the state store."""
        self.path = path

    def load(self) -> dict[str, dict[str, object]]:
        """Load completed slots."""
        if not self.path.exists():
            return {}
        value = read_json(self.path)
        if not isinstance(value, dict) or value.get("schema_version") != 1:
            raise ValueError("consumer state has an unsupported schema")
        slots = value.get("completed_slots")
        if not isinstance(slots, dict):
            raise ValueError("consumer completed_slots must be an object")
        return slots

    def should_process(self, payload: DispatchPayload) -> bool:
        """Reject replays and conflicting generations unless forced."""
        record = self.load().get(payload.slot_id)
        if record is None:
            return True
        if record.get("generation_id") == payload.generation_id:
            return False
        if not payload.force:
            raise ValueError("slot already contains a different generation")
        return True

    def complete(self, payload: DispatchPayload, website_generation_id: str) -> None:
        """Record a website generation only after successful regeneration."""
        slots = self.load()
        slots[payload.slot_id] = {
            **asdict(payload),
            "website_generation_id": website_generation_id,
        }
        atomic_write_json(self.path, {"schema_version": 1, "completed_slots": slots})


def validate_source(
    payload: DispatchPayload, manifest_path: Path, feed_path: Path
) -> object:
    """Validate feed and manifest against the immutable dispatch metadata."""
    manifest = read_json(manifest_path)
    feed = read_json(feed_path)
    if not isinstance(manifest, dict):
        raise ValueError("source manifest must be an object")
    expected = {
        "slot_id": payload.slot_id,
        "generation_id": payload.generation_id,
        "schema_version": payload.schema_version,
        "completed_at": payload.completed_at,
        "report_count": payload.report_count,
        "collection_status": "success",
        "manifest_schema_version": "1.0",
    }
    if manifest != expected:
        raise ValueError("source manifest does not match dispatch payload")
    validate_document(feed)
    assert isinstance(feed, dict)
    if len(feed["reports"]) != payload.report_count:
        raise ValueError("feed report count does not match dispatch payload")
    return feed

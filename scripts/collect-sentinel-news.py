"""Collect verified free Sentinel news/telemetry sources into a feed-only JSON publication."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from collectors.sentinel_sources import (
    SourceCollectionError,
    build_publication,
    collect_sources,
    load_registry,
    write_json_atomic,
)


def _timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _load_json(path: Path, fallback: object) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=Path("config/sentinel_sources.json"))
    parser.add_argument("--output", type=Path, default=Path("data/sentinel_news.json"))
    parser.add_argument("--state", type=Path, default=Path("data/sentinel_news_state.json"))
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    try:
        sources = load_registry(args.registry)
        state = _load_json(args.state, {})
        if not isinstance(state, dict):
            raise SourceCollectionError("collector state must be a JSON object")
        items, health, next_state = collect_sources(
            sources,
            state,
            max_workers=max(1, min(args.workers, 8)),
        )
        generated_at = _timestamp()
        previous = _load_json(args.output, None)
        candidate = build_publication(items, health, generated_at=generated_at)
        if isinstance(previous, dict):
            comparable_previous = {key: value for key, value in previous.items() if key != "generated_at"}
            comparable_candidate = {key: value for key, value in candidate.items() if key != "generated_at"}
            if comparable_previous == comparable_candidate:
                candidate["generated_at"] = previous.get("generated_at", generated_at)
        write_json_atomic(args.output, candidate)
        write_json_atomic(args.state, next_state)
        print(f"Collected {candidate['count']} Sentinel feed items from {len(health)} sources ({candidate['health']['status']}).")
        return 0
    except (OSError, ValueError, SourceCollectionError) as error:
        print(f"Sentinel news collection failed: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

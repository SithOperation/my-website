from datetime import UTC, datetime, timedelta

import pytest

from models.source_feed_contract import validate_document

NOW = datetime(2026, 7, 28, 12, tzinfo=UTC)


def document() -> dict[str, object]:
    return {
        "schema_version": "1.0",
        "publication_id": "publication",
        "generated_at": NOW.isoformat(),
        "count": 0,
        "health": {"status": "unavailable", "sources": []},
        "items": [],
    }


def test_empty_unavailable_feed_is_valid() -> None:
    assert validate_document(
        document(),
        "source_feed.json",
        publication_id="publication",
        now=NOW,
    )


def test_mixed_publication_is_rejected() -> None:
    with pytest.raises(ValueError, match="publication ID"):
        validate_document(
            document(),
            "source_feed.json",
            publication_id="different",
            now=NOW,
        )


def test_expired_item_is_rejected() -> None:
    value = document()
    value["count"] = 1
    value["items"] = [
        {
            "id": "src_1",
            "feed_eligible": True,
            "expires_at": (NOW - timedelta(seconds=1)).isoformat(),
            "content_hash": f"sha256:{'a' * 64}",
            "location_confidence": 0.0,
            "claim_confidence": 0.0,
            "association_confidence": 0.0,
        }
    ]
    with pytest.raises(ValueError, match="expired"):
        validate_document(
            value,
            "source_feed.json",
            publication_id="publication",
            now=NOW,
        )

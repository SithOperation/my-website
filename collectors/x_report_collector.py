"""Load validated X report documents for website generation."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from models.x_report_contract import validate_document

LOGGER = logging.getLogger(__name__)


def normalize_x_url(url: str) -> str:
    """Return a canonical X status URL from a supported public URL."""

    parsed = urlsplit(str(url).strip())
    if parsed.scheme != "https" or parsed.netloc.lower() not in {
        "x.com",
        "www.x.com",
        "twitter.com",
        "www.twitter.com",
    }:
        raise ValueError("url must be a public https X/Twitter status URL")
    path = re.sub(r"/+", "/", parsed.path).rstrip("/")
    if not re.fullmatch(r"/[A-Za-z0-9_]+/status/\d+", path):
        raise ValueError("url must identify an X status")
    return urlunsplit(("https", "x.com", path, "", ""))


def load_x_reports(path: str | Path) -> list[dict[str, Any]]:
    """Load a strict schema 1.0 document without applying map retention."""

    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    # Synchronization rejects stale reports. Generation also accepts stale
    # documents defensively so normalization can remove their markers.
    validate_document(payload, str(path), retention_hours=1_000_000)
    assert isinstance(payload, dict)
    reports = payload["reports"]
    assert isinstance(reports, list)
    LOGGER.info("[X REPORTS] Loaded %d validated reports", len(reports))
    return [dict(source) for source in reports]

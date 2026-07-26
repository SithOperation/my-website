"""Load validated X report documents for website generation."""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

from models.x_report_contract import validate_document

LOGGER = logging.getLogger(__name__)
USER_AGENT = (
    "SentinelGrid-EarlyReports/1.0 (public research; contact: website operator)"
)


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


def _fetch_public_text(url: str, timeout: float = 8.0) -> str | None:
    """Fetch optional public description metadata for a canonical report URL."""

    request = Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html"},
    )
    with urlopen(request, timeout=timeout) as response:
        body = response.read(1_000_000).decode(
            response.headers.get_content_charset() or "utf-8",
            errors="replace",
        )
    match = re.search(
        r'<meta[^>]+(?:name|property)=["\']'
        r'(?:twitter:description|og:description)["\'][^>]+'
        r'content=["\']([^"\']+)',
        body,
        re.IGNORECASE,
    )
    return match.group(1).strip() if match else None


def load_x_reports(
    path: str | Path,
    fetch_enabled: bool | None = None,
    timeout: float = 8.0,
) -> list[dict[str, Any]]:
    """Load a strict schema 1.0 document without applying map retention."""

    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    # Synchronization rejects stale reports. Generation also accepts stale
    # documents defensively so normalization can remove their markers.
    validate_document(payload, str(path), retention_hours=1_000_000)
    assert isinstance(payload, dict)
    reports = payload["reports"]
    assert isinstance(reports, list)
    enabled = (
        os.getenv("ENABLE_X_FETCH", "").lower() == "true"
        if fetch_enabled is None
        else fetch_enabled
    )
    LOGGER.info("[X REPORTS] Loaded %d validated reports", len(reports))
    LOGGER.info(
        "[X REPORTS] Live fetching %s",
        "enabled" if enabled else "disabled",
    )
    collected: list[dict[str, Any]] = []
    for source in reports:
        assert isinstance(source, dict)
        report = dict(source)
        report.update(
            fetch_attempted=False,
            fetch_succeeded=False,
            fetch_error=None,
            fetched_text=None,
        )
        if enabled:
            report["fetch_attempted"] = True
            try:
                fetched = _fetch_public_text(report["source_url"], timeout)
                report["fetched_text"] = fetched
                report["fetch_succeeded"] = bool(fetched)
                if not fetched:
                    report["fetch_error"] = (
                        "public metadata did not contain report text"
                    )
            except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
                report["fetch_error"] = f"{type(error).__name__}: {error}"
                LOGGER.warning(
                    "[X REPORTS] Fetch failed for %s: %s",
                    report["source_url"],
                    report["fetch_error"],
                )
        collected.append(report)
    return collected

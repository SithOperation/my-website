"""Manual-first, optional best-effort X report collection."""

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

LOGGER = logging.getLogger(__name__)
REQUIRED_FIELDS = {"url", "account", "text", "source_class", "location_name", "latitude", "longitude", "location_precision", "event_type"}
USER_AGENT = "SentinelGrid-EarlyReports/1.0 (public research; contact: website operator)"


def normalize_x_url(url: str) -> str:
    parsed = urlsplit(str(url).strip())
    if parsed.scheme != "https" or parsed.netloc.lower() not in {"x.com", "www.x.com", "twitter.com", "www.twitter.com"}:
        raise ValueError("url must be a public https X/Twitter status URL")
    host = "x.com"
    path = re.sub(r"/+", "/", parsed.path).rstrip("/")
    if not re.fullmatch(r"/[A-Za-z0-9_]+/status/\d+", path):
        raise ValueError("url must identify an X status")
    return urlunsplit(("https", host, path, "", ""))


def _fetch_public_text(url: str, timeout: float = 8.0) -> str | None:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urlopen(request, timeout=timeout) as response:
        body = response.read(1_000_000).decode(response.headers.get_content_charset() or "utf-8", errors="replace")
    match = re.search(r'<meta[^>]+(?:name|property)=["\'](?:twitter:description|og:description)["\'][^>]+content=["\']([^"\']+)', body, re.I)
    return match.group(1).strip() if match else None


def load_x_reports(path: str | Path, fetch_enabled: bool | None = None, timeout: float = 8.0) -> list[dict[str, Any]]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    reports = payload.get("reports")
    if not isinstance(reports, list):
        raise ValueError("x_sources.json must contain a reports array")
    enabled = os.getenv("ENABLE_X_FETCH", "").lower() == "true" if fetch_enabled is None else fetch_enabled
    LOGGER.info("[X REPORTS] Loaded %d manually supplied reports", len(reports))
    LOGGER.info("[X REPORTS] Live fetching %s", "enabled" if enabled else "disabled")
    collected = []
    for index, source in enumerate(reports):
        if not isinstance(source, dict):
            raise ValueError(f"report {index} must be an object")
        missing = sorted(field for field in REQUIRED_FIELDS if field not in source)
        if missing:
            raise ValueError(f"report {index} missing required fields: {', '.join(missing)}")
        report = dict(source)
        report["url"] = normalize_x_url(report["url"])
        report.update(fetch_attempted=False, fetch_succeeded=False, fetch_error=None, fetched_text=None)
        if enabled:
            report["fetch_attempted"] = True
            try:
                fetched = _fetch_public_text(report["url"], timeout)
                report["fetched_text"] = fetched
                report["fetch_succeeded"] = bool(fetched)
                if not fetched:
                    report["fetch_error"] = "public metadata did not contain report text"
            except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
                report["fetch_error"] = f"{type(error).__name__}: {error}"
                LOGGER.warning("[X REPORTS] Fetch failed for %s: %s", report["url"], report["fetch_error"])
        collected.append(report)
    return collected

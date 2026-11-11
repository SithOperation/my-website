"""Free, structured Sentinel source collection primitives.

The collector deliberately produces a feed separate from the authoritative
``data/map_events.json`` publication. RSS headlines without source-supplied
coordinates are useful to readers but are never promoted to map events.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Iterable, Mapping
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree

SCHEMA_VERSION = "1.0"
USER_AGENT = "SentinelGrid/1.0 (+https://sithbusiness.com/sentinel.html)"
DEFAULT_TIMEOUT_SECONDS = 20
DEFAULT_RETRIES = 2
MAX_SUMMARY_LENGTH = 500
_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")

PRIORITY_COUNTRY_ALIASES: dict[str, tuple[str, ...]] = {
    "Iran": ("iran", "iranian", "tehran"),
    "Lithuania": ("lithuania", "lithuanian", "vilnius"),
    "Poland": ("poland", "polish", "warsaw"),
    "Germany": ("germany", "german", "berlin"),
    "Estonia": ("estonia", "estonian", "tallinn"),
    "Russia": ("russia", "russian", "moscow", "kremlin"),
    "China": ("china", "chinese", "beijing", "taiwan strait"),
    "South Korea": ("south korea", "republic of korea", "korean", "seoul"),
    "North Korea": ("north korea", "dprk", "pyongyang"),
    "Taiwan": ("taiwan", "taipei"),
    "Japan": ("japan", "japanese", "tokyo"),
}

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "conflict": ("war", "battle", "airstrike", "missile", "shelling", "troops"),
    "cybersecurity": ("cyber", "ransomware", "vulnerability", "malware", "hack"),
    "politics": ("government", "election", "minister", "president", "parliament"),
    "natural_hazard": ("earthquake", "flood", "volcano", "wildfire", "storm"),
    "space_weather": ("solar wind", "geomagnetic", "space weather"),
}


class SourceCollectionError(RuntimeError):
    """Raised when a source registry or response cannot be safely processed."""


@dataclass(frozen=True)
class SourceSpec:
    """Validated source configuration."""

    id: str
    publisher: str
    endpoint: str
    source_type: str
    categories: tuple[str, ...]
    language: str
    polling_interval_minutes: int
    authentication: str
    country_or_region: str
    official_website: str
    usage_restrictions: str
    reliability: str
    enabled: bool

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any], index: int) -> "SourceSpec":
        required = (
            "id", "publisher", "country_or_region", "official_website",
            "endpoint", "source_type", "categories", "language",
            "polling_interval_minutes", "authentication", "usage_restrictions",
            "reliability", "enabled", "endpoint_verified_at",
            "last_successful_fetch", "last_error",
        )
        missing = [field for field in required if field not in value]
        if missing:
            raise SourceCollectionError(
                f"sources[{index}] is missing: {', '.join(missing)}"
            )
        source_id = str(value["id"]).strip()
        endpoint = str(value["endpoint"]).strip()
        source_type = str(value["source_type"]).strip().lower()
        if not source_id or not re.fullmatch(r"[a-z0-9][a-z0-9-]+", source_id):
            raise SourceCollectionError(f"sources[{index}] has an invalid id")
        if not endpoint.startswith("https://"):
            raise SourceCollectionError(f"{source_id} endpoint must use HTTPS")
        if source_type not in {"rss", "atom", "json", "geojson"}:
            raise SourceCollectionError(f"{source_id} has unsupported type {source_type}")
        categories = value["categories"]
        if not isinstance(categories, list) or not categories or not all(
            isinstance(item, str) and item.strip() for item in categories
        ):
            raise SourceCollectionError(f"{source_id} categories must be non-empty strings")
        interval = value["polling_interval_minutes"]
        if isinstance(interval, bool) or not isinstance(interval, int) or interval < 5:
            raise SourceCollectionError(f"{source_id} polling interval is invalid")
        if value["enabled"] and not value["endpoint_verified_at"]:
            raise SourceCollectionError(f"{source_id} cannot be enabled before verification")
        return cls(
            id=source_id,
            publisher=str(value["publisher"]).strip(),
            endpoint=endpoint,
            source_type=source_type,
            categories=tuple(str(item).strip() for item in categories),
            language=str(value["language"]).strip(),
            polling_interval_minutes=interval,
            authentication=str(value["authentication"]).strip(),
            country_or_region=str(value["country_or_region"]).strip(),
            official_website=str(value["official_website"]).strip(),
            usage_restrictions=str(value["usage_restrictions"]).strip(),
            reliability=str(value["reliability"]).strip(),
            enabled=bool(value["enabled"]),
        )


@dataclass(frozen=True)
class FetchedDocument:
    """A response body plus cache and rate-limit metadata."""

    body: bytes
    headers: Mapping[str, str]
    status: int


def load_registry(path: Path) -> tuple[SourceSpec, ...]:
    """Load and validate the JSON registry, rejecting duplicate source IDs."""

    document = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict) or document.get("schema_version") != SCHEMA_VERSION:
        raise SourceCollectionError("source registry schema version mismatch")
    sources = document.get("sources")
    if not isinstance(sources, list) or not sources:
        raise SourceCollectionError("source registry must contain sources")
    result = tuple(SourceSpec.from_mapping(value, index) for index, value in enumerate(sources))
    ids = [source.id for source in result]
    if len(ids) != len(set(ids)):
        raise SourceCollectionError("source registry contains duplicate IDs")
    return result


def parse_timestamp(value: object) -> str | None:
    """Normalize common RSS/Atom/ISO timestamps to UTC RFC3339."""

    if not value:
        return None
    text = str(value).strip()
    parsed: datetime | None = None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(text)
        except (TypeError, ValueError, OverflowError):
            return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def clean_text(value: object, maximum: int = MAX_SUMMARY_LENGTH) -> str:
    """Strip markup and bound copied feed text to a short summary."""

    text = html.unescape(_TAG_RE.sub(" ", str(value or "")))
    text = _SPACE_RE.sub(" ", text).strip()
    if len(text) <= maximum:
        return text
    shortened = text[: maximum - 1].rsplit(" ", 1)[0]
    return f"{shortened or text[: maximum - 1]}…"


def valid_coordinates(latitude: object, longitude: object) -> bool:
    """Accept only explicit geographic coordinates; reject the null island placeholder."""

    try:
        lat = float(str(latitude))
        lon = float(str(longitude))
    except (TypeError, ValueError):
        return False
    return -90 <= lat <= 90 and -180 <= lon <= 180 and not (lat == 0 and lon == 0)


def _coordinate_pair(latitude: object, longitude: object) -> tuple[float, float] | None:
    if not valid_coordinates(latitude, longitude):
        return None
    return float(str(latitude)), float(str(longitude))


def classify_countries(text: str) -> list[str]:
    """Classify country mentions for feed filtering without creating coordinates."""

    folded = text.casefold()
    return [
        country for country, aliases in PRIORITY_COUNTRY_ALIASES.items()
        if any(re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", folded) for alias in aliases)
    ]


def classify_categories(text: str, defaults: Iterable[str]) -> list[str]:
    """Add conservative keyword categories to the source's declared categories."""

    folded = text.casefold()
    categories = list(dict.fromkeys(defaults))
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in folded for keyword in keywords) and category not in categories:
            categories.append(category)
    return categories


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].casefold()


def _children_text(element: ElementTree.Element) -> dict[str, str]:
    values: dict[str, str] = {}
    for child in list(element):
        name = _local_name(child.tag)
        text = "".join(child.itertext()).strip()
        if name == "link" and child.attrib.get("href"):
            text = child.attrib["href"]
        if text and name not in values:
            values[name] = text
    return values


def _feed_items(source: SourceSpec, body: bytes, collected_at: str) -> list[dict[str, Any]]:
    root = ElementTree.fromstring(body)
    records = [node for node in root.iter() if _local_name(node.tag) in {"item", "entry"}]
    items: list[dict[str, Any]] = []
    for record in records:
        values = _children_text(record)
        title = clean_text(values.get("title"), 220)
        url = values.get("link") or values.get("guid") or ""
        if not title or not url.startswith("https://"):
            continue
        published_at = parse_timestamp(
            values.get("pubdate") or values.get("published") or values.get("updated")
        )
        summary = clean_text(values.get("description") or values.get("summary"), MAX_SUMMARY_LENGTH)
        text = f"{title} {summary}"
        items.append(_make_item(
            source=source,
            title=title,
            summary=summary,
            url=url,
            published_at=published_at,
            collected_at=collected_at,
        ))
    return items


def _json_items(source: SourceSpec, body: bytes, collected_at: str) -> list[dict[str, Any]]:
    document = json.loads(body.decode("utf-8"))
    records: list[Mapping[str, Any]]
    if source.source_type == "geojson":
        records = [record for record in document.get("features", []) if isinstance(record, dict)]
    elif isinstance(document, list):
        records = [record for record in document if isinstance(record, dict)]
    elif isinstance(document, dict) and isinstance(document.get("items"), list):
        records = [record for record in document["items"] if isinstance(record, dict)]
    else:
        records = [document] if isinstance(document, dict) else []

    items: list[dict[str, Any]] = []
    for record in records:
        properties = record.get("properties", record)
        if not isinstance(properties, Mapping):
            continue
        geometry = record.get("geometry")
        coordinates = geometry.get("coordinates") if isinstance(geometry, Mapping) else None
        longitude = coordinates[0] if isinstance(coordinates, list) and len(coordinates) >= 2 else properties.get("longitude")
        latitude = coordinates[1] if isinstance(coordinates, list) and len(coordinates) >= 2 else properties.get("latitude")
        title = clean_text(properties.get("title") or properties.get("name") or properties.get("event"), 220)
        url = str(properties.get("url") or properties.get("link") or properties.get("web") or "")
        if not title:
            continue
        items.append(_make_item(
            source=source,
            title=title,
            summary=clean_text(properties.get("description") or properties.get("summary")),
            url=url if url.startswith("https://") else source.official_website,
            published_at=parse_timestamp(properties.get("time") or properties.get("published") or properties.get("pubDate")),
            collected_at=collected_at,
            latitude=latitude if valid_coordinates(latitude, longitude) else None,
            longitude=longitude if valid_coordinates(latitude, longitude) else None,
        ))
    return items


def _make_item(
    *,
    source: SourceSpec,
    title: str,
    summary: str,
    url: str,
    published_at: str | None,
    collected_at: str,
    latitude: object = None,
    longitude: object = None,
) -> dict[str, Any]:
    countries = classify_countries(f"{title} {summary}")
    categories = classify_categories(f"{title} {summary}", source.categories)
    identity = f"{source.id}|{url}|{title.casefold()}"
    coordinates = _coordinate_pair(latitude, longitude)
    return {
        "id": hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24],
        "title": title,
        "summary": summary,
        "url": url,
        "publisher": source.publisher,
        "source_id": source.id,
        "source_type": source.source_type,
        "language": source.language,
        "published_at": published_at,
        "collected_at": collected_at,
        "countries": countries,
        "categories": categories,
        "latitude": coordinates[0] if coordinates else None,
        "longitude": coordinates[1] if coordinates else None,
        "geolocation_confidence": "source_supplied" if coordinates else None,
        "claim_status": "published_source_report",
        "feed_eligible": True,
    }


def parse_document(source: SourceSpec, body: bytes, collected_at: str) -> list[dict[str, Any]]:
    """Parse a validated RSS/Atom/JSON/GeoJSON response into feed items."""

    if source.source_type in {"rss", "atom"}:
        return _feed_items(source, body, collected_at)
    return _json_items(source, body, collected_at)


def _header(headers: Mapping[str, str], name: str) -> str | None:
    wanted = name.casefold()
    for key, value in headers.items():
        if str(key).casefold() == wanted:
            return str(value)
    return None


def fetch_document(
    source: SourceSpec,
    state: Mapping[str, Any] | None = None,
    *,
    opener: Callable[..., Any] = urlopen,
    sleep: Callable[[float], None] = time.sleep,
    now: Callable[[], float] = time.time,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    retries: int = DEFAULT_RETRIES,
) -> tuple[FetchedDocument | None, dict[str, Any]]:
    """Fetch one source with conditional requests and bounded exponential retry."""

    previous = state or {}
    headers = {"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/geo+json, application/json;q=0.9"}
    for state_name, header_name in (("etag", "If-None-Match"), ("last_modified", "If-Modified-Since")):
        if previous.get(state_name):
            headers[header_name] = str(previous[state_name])
    last_error = ""
    for attempt in range(retries + 1):
        try:
            with opener(Request(source.endpoint, headers=headers), timeout=timeout) as response:
                response_headers = dict(response.headers.items())
                status = int(getattr(response, "status", 200))
                if status == 304:
                    return None, {"status": "unchanged", "etag": _header(response_headers, "etag") or previous.get("etag"), "last_modified": _header(response_headers, "last-modified") or previous.get("last_modified")}
                return FetchedDocument(response.read(), response_headers, status), {
                    "status": "ok",
                    "etag": _header(response_headers, "etag"),
                    "last_modified": _header(response_headers, "last-modified"),
                }
        except HTTPError as error:
            if error.code == 304:
                return None, {"status": "unchanged", "etag": previous.get("etag"), "last_modified": previous.get("last_modified")}
            last_error = f"HTTP {error.code}"
            if error.code not in {408, 425, 429, 500, 502, 503, 504} or attempt >= retries:
                break
            retry_after = error.headers.get("Retry-After") if error.headers else None
            try:
                delay = max(0.0, float(retry_after)) if retry_after else 2**attempt
            except ValueError:
                delay = 2**attempt
            sleep(min(delay, 30.0))
        except (URLError, TimeoutError, OSError) as error:
            last_error = str(error) or error.__class__.__name__
            if attempt >= retries:
                break
            sleep(min(2**attempt, 30.0))
    return None, {"status": "error", "error": last_error or "request failed", "last_attempt": now()}


def deduplicate_items(items: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate by stable ID, URL, and normalized publisher/title identity."""

    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for raw in items:
        item = dict(raw)
        identity = "|".join((str(item.get("url", "")), str(item.get("publisher", "")), clean_text(item.get("title"), 220).casefold()))
        key = str(item.get("id")) or hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24]
        if key in seen or identity in seen:
            continue
        seen.update((key, identity))
        item["id"] = key
        result.append(item)
    return result


def collect_sources(
    sources: Iterable[SourceSpec],
    state: Mapping[str, Mapping[str, Any]] | None = None,
    *,
    max_workers: int = 4,
    fetcher: Callable[..., tuple[FetchedDocument | None, dict[str, Any]]] = fetch_document,
    collected_at: str | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """Collect enabled sources concurrently without allowing one failure to abort all."""

    timestamp = collected_at or datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
    source_list = [source for source in sources if source.enabled]
    items: list[dict[str, Any]] = []
    health: list[dict[str, Any]] = []
    next_state: dict[str, dict[str, Any]] = {}
    lock = Lock()

    def collect_one(source: SourceSpec) -> tuple[SourceSpec, list[dict[str, Any]], dict[str, Any]]:
        document, result = fetcher(source, (state or {}).get(source.id, {}))
        if document is None:
            return source, [], result
        parsed = parse_document(source, document.body, timestamp)
        return source, parsed, result

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(collect_one, source): source for source in source_list}
        for future in as_completed(futures):
            source = futures[future]
            try:
                _, parsed, result = future.result()
            except Exception as error:  # collection must degrade per source
                parsed, result = [], {"status": "error", "error": str(error)}
            with lock:
                items.extend(parsed)
                health.append({"source_id": source.id, "publisher": source.publisher, **result})
                next_state[source.id] = {key: value for key, value in result.items() if key in {"etag", "last_modified"}}
    health.sort(key=lambda item: item["source_id"])
    return deduplicate_items(items), health, next_state


def build_publication(
    items: Iterable[Mapping[str, Any]],
    health: Iterable[Mapping[str, Any]],
    *,
    generated_at: str,
) -> dict[str, Any]:
    """Build the standalone news publication consumed by the Sentinel UI."""

    publication_items = [dict(item) for item in items]
    health_items = [dict(item) for item in health]
    statuses = {str(item.get("status")) for item in health_items}
    status = "fresh" if health_items and statuses <= {"ok", "unchanged"} else "partial" if any(item.get("status") in {"ok", "unchanged"} for item in health_items) else "unavailable"
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "count": len(publication_items),
        "health": {"status": status, "sources": health_items},
        "items": publication_items,
    }


def write_json_atomic(path: Path, value: object) -> None:
    """Write JSON through a sibling temporary file and atomic replacement."""

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)

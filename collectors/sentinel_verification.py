"""Configurable, explainable Sentinel event classification and verification.

This module deliberately distinguishes a detected report from a verified fact.
It uses deterministic rules and source metadata; it is not a probabilistic
truth engine and never fabricates a location or evidence.
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence, cast

SCHEMA_VERSION = "1.0"
VERIFICATION_STATUSES = frozenset({
    "unverified", "single-source report", "corroborated", "officially confirmed",
    "disputed", "debunked", "retracted",
})
_WORD_RE = re.compile(r"[\w]+(?:[’'][\w]+)?", re.UNICODE)
_SENTENCE_RE = re.compile(r"(?<=[.!?。！？])\s+|\n+")
_NEGATION_RE = re.compile(r"\b(?:not|no|never|denied|denies|deny|false|untrue|without evidence)\b", re.I)
_HYPOTHETICAL_RE = re.compile(r"\b(?:could|would|may|might|if|scenario|simulation|exercise|predicted|expected|possible|alleged|reportedly)\b", re.I)
_HISTORICAL_RE = re.compile(r"\b(?:in \d{4}|years? ago|historical|previously|last year|decades? ago|on this date)\b", re.I)
_RETRACTION_RE = re.compile(r"\b(?:retracted|withdrawn|correction issued|corrected report|retraction)\b", re.I)
_DEBUNKED_RE = re.compile(r"\b(?:debunked|hoax|fabricated|false claim|fake report|misinformation)\b", re.I)
_CONTRADICTION_RE = re.compile(r"\b(?:denied|denies|denial|disputed|contradicts?|no evidence|unconfirmed)\b", re.I)
_STOPWORDS = frozenset("the a an and or of to in on for from by with at is are was were be been this that report reports says said news after before latest".split())
_OFFICIAL_PUBLISHERS = frozenset({"USGS", "NOAA SWPC", "CISA", "National Weather Service", "FEMA", "IAEA", "WHO"})
_SEVERITY_ORDER = {"UNKNOWN": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
_MILITARY_RE = re.compile(r"\b(?:war|conflict|armed conflict|military|missile|airstrike|air strike|shelling|hostilities|offensive|occupation|ceasefire)\b", re.I)
_HIGH_IMPACT_MILITARY_RE = re.compile(r"\b(?:nuclear|radiological|mass casualties?|invasion|major attack|killed|dead|fatalities|civilian casualties|active combat|missile strike|airstrike|shelling)\b", re.I)


@dataclass(frozen=True)
class KeywordRule:
    category: str
    primary: tuple[str, ...]
    related: tuple[str, ...]
    exclusions: tuple[str, ...]
    contexts: tuple[str, ...]
    subcategory: str


def _norm(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return re.sub(r"\s+", " ", text).strip()


def _contains(text: str, phrase: str) -> bool:
    phrase_norm = _norm(phrase)
    if not phrase_norm:
        return False
    return re.search(rf"(?<!\w){re.escape(phrase_norm)}(?!\w)", text) is not None


def load_keyword_rules(path: Path) -> tuple[KeywordRule, ...]:
    """Load and validate the external keyword dictionary."""

    document = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict) or document.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("keyword dictionary schema version mismatch")
    raw_rules = document.get("rules")
    if not isinstance(raw_rules, dict) or not raw_rules:
        raise ValueError("keyword dictionary must contain rules")
    rules: list[KeywordRule] = []
    for category, raw in raw_rules.items():
        if not isinstance(raw, Mapping):
            raise ValueError(f"keyword rule {category} is not an object")
        values: dict[str, tuple[str, ...]] = {}
        for field in ("primary", "related", "exclusions", "contexts"):
            items = raw.get(field, [])
            if not isinstance(items, list) or not all(isinstance(item, str) and item.strip() for item in items):
                raise ValueError(f"keyword rule {category}.{field} is invalid")
            values[field] = tuple(item.strip() for item in items)
        if not values["primary"] or not str(raw.get("subcategory", "")).strip():
            raise ValueError(f"keyword rule {category} needs primary keywords and a subcategory")
        rules.append(KeywordRule(
            category=str(category),
            primary=values["primary"],
            related=values["related"],
            exclusions=values["exclusions"],
            contexts=values["contexts"],
            subcategory=str(raw["subcategory"]),
        ))
    return tuple(rules)


def _sentences(text: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in _SENTENCE_RE.split(text) if part.strip()) or (text,)


def classify_text(title: object, summary: object, rules: Iterable[KeywordRule], multilingual: Mapping[str, Iterable[str]] | None = None) -> list[dict[str, Any]]:
    """Return only context-supported candidate categories and matched terms."""

    raw = f"{title or ''}. {summary or ''}"
    text = _norm(raw)
    results: list[dict[str, Any]] = []
    for rule in rules:
        multilingual_terms = tuple((multilingual or {}).get(rule.category, ()))
        terms = tuple(dict.fromkeys((*rule.primary, *rule.related, *multilingual_terms)))
        matched: list[str] = []
        evidence_sentences: list[str] = []
        for sentence in _sentences(text):
            found = [term for term in terms if _contains(sentence, term)]
            if not found:
                continue
            if any(_contains(sentence, exclusion) for exclusion in rule.exclusions):
                continue
            if rule.contexts and not any(_contains(sentence, context) for context in rule.contexts):
                # A primary phrase is sufficient for narrowly defined event terms;
                # related terms still require a contextual action.
                if not any(_contains(sentence, primary) for primary in (*rule.primary, *multilingual_terms)):
                    continue
            matched.extend(found)
            evidence_sentences.append(sentence)
        if matched:
            unique = list(dict.fromkeys(matched))
            results.append({
                "category": rule.category,
                "subcategory": rule.subcategory,
                "detected_keywords": unique,
                "classification_explanation": f"Matched {', '.join(unique[:6])} in an action-supported sentence.",
                "historical": bool(_HISTORICAL_RE.search(text)),
                "hypothetical": bool(_HYPOTHETICAL_RE.search(text)),
                "negated": bool(_NEGATION_RE.search(" ".join(evidence_sentences))),
            })
    return results


def _tokens(value: object) -> set[str]:
    return {token for token in _WORD_RE.findall(_norm(value)) if token not in _STOPWORDS and len(token) > 2}


def _event_key(item: Mapping[str, Any]) -> str:
    categories = ",".join(sorted(str(value) for value in item.get("categories", []) if value))
    country = ",".join(sorted(str(value) for value in item.get("countries", []) if value))
    words = " ".join(sorted(_tokens(item.get("title"))))
    return hashlib.sha256(f"{categories}|{country}|{words}".encode("utf-8")).hexdigest()[:20]


def _source_group(item: Mapping[str, Any]) -> str:
    return str(item.get("independence_group") or item.get("source_id") or item.get("publisher") or "unknown").casefold()


def _is_official(item: Mapping[str, Any]) -> bool:
    if bool(item.get("official_source")):
        return True
    return str(item.get("publisher", "")).strip() in _OFFICIAL_PUBLISHERS


def _parse_time(value: object) -> datetime | None:
    if not value:
        return None
    try:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return result.replace(tzinfo=result.tzinfo or UTC).astimezone(UTC)


def _same_event(left: Mapping[str, Any], right: Mapping[str, Any]) -> bool:
    left_categories = set(left.get("categories", []))
    right_categories = set(right.get("categories", []))
    if left_categories and right_categories and not left_categories.intersection(right_categories):
        return False
    left_countries = set(left.get("countries", []))
    right_countries = set(right.get("countries", []))
    if left_countries and right_countries and not left_countries.intersection(right_countries):
        return False
    left_time, right_time = _parse_time(left.get("published_at")), _parse_time(right.get("published_at"))
    if left_time and right_time and abs(left_time - right_time) > timedelta(hours=72):
        return False
    a, b = _tokens(left.get("title")), _tokens(right.get("title"))
    if not a or not b:
        return False
    return len(a.intersection(b)) / max(1, len(a.union(b))) >= 0.55


def _status_for_group(group: Sequence[Mapping[str, Any]], now: str) -> dict[str, Any]:
    sources = {_source_group(item) for item in group}
    official = any(_is_official(item) for item in group)
    text = " ".join(f"{item.get('title', '')} {item.get('summary', '')}" for item in group)
    evidence = [{"publisher": item.get("publisher"), "url": item.get("url"), "source_id": item.get("source_id")} for item in group]
    contradictions = [item.get("url") for item in group if _CONTRADICTION_RE.search(f"{item.get('title', '')} {item.get('summary', '')}")]
    if _RETRACTION_RE.search(text):
        status = "retracted"
    elif _DEBUNKED_RE.search(text):
        status = "debunked"
    elif contradictions and len(sources) > 1:
        status = "disputed"
    elif official:
        status = "officially confirmed"
    elif len(sources) > 1:
        status = "corroborated"
    elif group:
        status = "single-source report"
    else:
        status = "unverified"
    score = 18 if group else 0
    score += min(30, max(0, (len(sources) - 1) * 20))
    score += 25 if official else 0
    score += 12 if all(_parse_time(item.get("published_at")) for item in group) else 0
    score -= min(35, len(contradictions) * 15)
    score = max(0, min(100, score))
    return {
        "status": status,
        "confidence_score": score,
        "independent_source_count": len(sources),
        "official_confirmation": official,
        "evidence": evidence,
        "contradictions": [url for url in contradictions if url],
        "last_checked": now,
        "explanation": f"{len(sources)} independent source group(s); official confirmation={'yes' if official else 'no'}; contradictions={len(contradictions)}.",
    }


def _subject_category(item: Mapping[str, Any]) -> str:
    """Return one stable subject category without changing source attribution."""

    categories = [str(value).casefold() for value in item.get("categories", []) if value]
    mapping = (
        ("military_activity", ("conflict", "military", "missile_activity", "armed_conflict")),
        ("cybersecurity_incident", ("cybersecurity", "cyber_incident", "cyber_advisory")),
        ("natural_disaster", ("natural_hazard", "earthquake", "severe_weather", "flood", "wildfire", "volcanic")),
        ("political_development", ("politics", "government", "government_action")),
        ("infrastructure_disruption", ("power_outage", "communications_outage", "transportation_incident", "industrial_accident")),
        ("economic_development", ("economic", "economic_disruption")),
        ("space_weather", ("space_weather", "emp_space")),
    )
    for subject, aliases in mapping:
        if any(category in aliases for category in categories):
            return subject
    return categories[0] if categories else "general_news"


def _information_type(item: Mapping[str, Any], verification: Mapping[str, Any]) -> str:
    """Classify the information state; keywords alone never confirm an incident."""

    text = f"{item.get('title', '')} {item.get('summary', '')}"
    if _HISTORICAL_RE.search(text):
        return "historical_incident"
    if bool(item.get("official_source")) or bool(verification.get("official_confirmation")):
        return "official_advisory"
    if _HYPOTHETICAL_RE.search(text) or _NEGATION_RE.search(text):
        return "unverified_report"
    if verification.get("status") == "corroborated":
        return "confirmed_incident" if item.get("latitude") is not None else "developing_situation"
    if verification.get("status") in {"disputed", "debunked", "retracted"}:
        return "unverified_report"
    if any(term in text.casefold() for term in ("analysis", "opinion", "editorial")):
        return "analysis_opinion"
    return "breaking_news"


def _lifecycle(item: Mapping[str, Any], information_type: str) -> str:
    text = f"{item.get('title', '')} {item.get('summary', '')}"
    if information_type == "historical_incident":
        return "historical"
    if _RETRACTION_RE.search(text) or _DEBUNKED_RE.search(text):
        return "resolved"
    if information_type in {"developing_situation", "breaking_news"}:
        return "developing"
    return "active" if information_type in {"official_advisory", "confirmed_incident"} else "published"


def _normalize_severity(item: Mapping[str, Any]) -> str:
    """Apply a conservative severity floor so war reports are never low."""

    raw = str(item.get("severity") or item.get("threat_level") or item.get("priority") or "UNKNOWN").upper()
    supplied = raw if raw in _SEVERITY_ORDER else "UNKNOWN"
    text = f"{item.get('title', '')} {item.get('summary', '')} {item.get('description', '')}"
    categories = " ".join(str(value) for value in item.get("categories", []) if value)
    if not _MILITARY_RE.search(f"{categories} {text}"):
        return supplied
    if _HIGH_IMPACT_MILITARY_RE.search(text):
        return "HIGH" if supplied != "CRITICAL" else supplied
    return "MEDIUM" if _SEVERITY_ORDER[supplied] < _SEVERITY_ORDER["MEDIUM"] else supplied


def verify_items(items: Iterable[Mapping[str, Any]], *, checked_at: str) -> list[dict[str, Any]]:
    """Attach conservative verification metadata without deleting source items."""

    records = [dict(item) for item in items]
    groups: list[list[dict[str, Any]]] = []
    for item in records:
        for group in groups:
            if _same_event(item, group[0]):
                group.append(item)
                break
        else:
            groups.append([item])
    result: list[dict[str, Any]] = []
    for group in groups:
        verification = _status_for_group(group, checked_at)
        for item in group:
            classification_value = item.get("classification")
            classification = cast(Mapping[str, Any], classification_value) if isinstance(classification_value, Mapping) else {}
            item["verification"] = {**verification, **{key: classification[key] for key in ("detected_keywords", "classification_explanation") if key in classification}}
            item["claim_status"] = item["verification"]["status"]
            item["severity"] = _normalize_severity(item)
            item["verification_status"] = item["verification"]["status"]
            item["subject_category"] = _subject_category(item)
            item["information_type"] = _information_type(item, item["verification"])
            item["lifecycle"] = _lifecycle(item, item["information_type"])
            item["occurrence_at"] = item.get("published_at")
            item["geographic_relevance"] = {
                "incident": [],
                "responsible": [],
                "affected": [],
                "mentioned": list(item.get("countries", [])),
                "confidence": "mentioned_only" if item.get("countries") else "none",
            }
            item["corroboration"] = {
                "independent_source_count": item["verification"]["independent_source_count"],
                "source_groups": sorted({_source_group(candidate) for candidate in group}),
                "evidence": item["verification"]["evidence"],
                "contradictions": item["verification"]["contradictions"],
            }
            result.append(item)
    return result

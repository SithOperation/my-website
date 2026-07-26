"""Build the authoritative governance source catalog from the supplied archive."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import stat
import zipfile
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any
from urllib.parse import unquote

SOURCE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def field(markdown: str, label: str) -> str:
    m = re.search(rf"^- \*\*{re.escape(label)}:\*\*\s*(.+)$", markdown, re.M)
    return m.group(1).strip() if m else ""


def section(markdown: str, title: str) -> str:
    m = re.search(
        rf"^## {re.escape(title)}\s*\n\s*(.+?)(?=\n## |\Z)", markdown, re.M | re.S
    )
    return " ".join(m.group(1).strip().split()) if m else ""


def category(source_id: str, title: str) -> str:
    text = f"{source_id} {title}".lower()
    if "hipaa" in text or "45-cfr" in text:
        return "healthcare-and-hipaa"
    if source_id.startswith("ISO-"):
        return "iso-standards"
    if "pci" in text:
        return "payment-security"
    if source_id.startswith("CISA-"):
        return "cisa-guidance"
    if "privacy" in text:
        return "privacy"
    if "incident" in text or "ransomware" in text:
        return "incident-response"
    if "ai-" in text or "42001" in text:
        return "ai-governance"
    if "sec-" in text or "ftc-" in text:
        return "regulatory"
    if "53" in text or "fips" in text:
        return "controls-and-baselines"
    if "risk" in text or "800-30" in text or "800-39" in text:
        return "risk-management"
    return "nist-governance"


def validate_source_id(value: object) -> str:
    """Return a safe manifest source identifier."""
    if (
        not isinstance(value, str)
        or SOURCE_ID_PATTERN.fullmatch(value) is None
        or value in {".", ".."}
        or ".." in value
    ):
        raise ValueError(f"Unsafe source_id: {value!r}")
    return value


def safe_archive_relative(name: str, prefix: str) -> PurePosixPath:
    """Return a decoded relative member path with traversal forms rejected."""
    decoded = name
    for _ in range(3):
        expanded = unquote(decoded)
        if expanded == decoded:
            break
        decoded = expanded
    normalized = decoded.replace("\\", "/")
    if "\x00" in normalized:
        raise ValueError("archive member contains a NUL byte")
    windows = PureWindowsPath(normalized)
    if windows.is_absolute() or windows.drive or normalized.startswith("//"):
        raise ValueError(f"Unsafe archive path: {name}")
    base = PurePosixPath(prefix)
    candidate = PurePosixPath(normalized)
    try:
        relative = candidate.relative_to(base)
    except ValueError as error:
        raise ValueError(f"Archive member is outside source prefix: {name}") from error
    if not relative.parts or any(part in {"", ".", ".."} for part in relative.parts):
        raise ValueError(f"Unsafe archive path: {name}")
    return relative


def safe_destination(root: Path, relative: PurePosixPath) -> Path:
    """Resolve a destination and prove it remains beneath root."""
    resolved_root = root.resolve()
    destination = resolved_root.joinpath(*relative.parts).resolve()
    if not destination.is_relative_to(resolved_root):
        raise ValueError(f"Archive destination escapes root: {relative}")
    for parent in destination.parents:
        if parent == resolved_root:
            break
        if parent.exists() and parent.is_symlink():
            raise ValueError(f"Archive destination crosses symlink: {relative}")
    return destination


def _is_symlink(info: zipfile.ZipInfo) -> bool:
    """Return whether a ZIP member encodes a Unix symbolic link."""
    return stat.S_ISLNK((info.external_attr >> 16) & 0xFFFF)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("archive", type=Path)
    p.add_argument("--root", type=Path, required=True)
    args = p.parse_args()
    root = args.root.resolve()
    source_root = root / "governance-library/sources"
    data_root = root / "data/governance-library"
    if source_root.exists():
        shutil.rmtree(source_root)
    source_root.mkdir(parents=True, exist_ok=True)
    data_root.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.archive) as zf:
        bad = zf.testzip()
        if bad:
            raise SystemExit(f"Archive CRC failure: {bad}")
        base = "cybersecurity-governance-library-v2/"
        manifest: Any = json.loads(zf.read(base + "manifest.json"))
        if not isinstance(manifest, list):
            raise ValueError("governance manifest must be an array")
        records: list[dict[str, Any]] = []
        for item in manifest:
            if not isinstance(item, dict):
                raise ValueError("governance manifest entries must be objects")
            sid = validate_source_id(item.get("source_id"))
            folder = safe_destination(source_root, PurePosixPath(sid))
            folder.mkdir(parents=True, exist_ok=True)
            if sid == "NIST-SP-800-18r1":
                shutil.rmtree(folder)
                continue
            prefix = base + sid + "/"
            for info in zf.infolist():
                if info.is_dir() or not info.filename.startswith(prefix):
                    continue
                if _is_symlink(info):
                    raise ValueError(f"Archive symlink is forbidden: {info.filename}")
                rel = safe_archive_relative(info.filename, prefix)
                target = safe_destination(folder, rel)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(zf.read(info))
            record_path = folder / "SOURCE_RECORD.md"
            markdown = record_path.read_text(encoding="utf-8-sig")
            title = markdown.splitlines()[0].removeprefix("# ").strip()
            authority = field(markdown, "Authority type")
            access = field(markdown, "Access / redistribution")
            note = section(markdown, "Library note")
            status = item["status"]
            records.append(
                {
                    "id": sid.lower(),
                    "source_id": sid,
                    "title": title,
                    "publisher": field(markdown, "Publisher"),
                    "edition": field(markdown, "Edition / revision"),
                    "publication_date": field(markdown, "Publication date"),
                    "authority_type": authority,
                    "access": access,
                    "status": status,
                    "category": category(sid, title),
                    "official_url": item["official_url"],
                    "direct_pdf_url": item.get("direct_pdf_url"),
                    "source_record": f"governance-library/sources/{sid}/SOURCE_RECORD.md",
                    "companion_summary": f"governance-library/sources/{sid}/COMPANION_SOURCE_SUMMARY.md",
                    "library_note": note
                    or "Use the official publisher source as the controlling authority.",
                    "as_researched_on": item["as_researched_on"],
                    "labels": item["required_labels"],
                    "prohibited": item["prohibited"],
                    "search_text": " ".join(
                        [
                            sid,
                            title,
                            field(markdown, "Publisher"),
                            authority,
                            field(markdown, "Edition / revision"),
                            note,
                        ]
                    ).lower(),
                }
            )
        for name in ["README.md", "manifest.json", "manifest.csv"]:
            (root / "governance-library" / name).write_bytes(zf.read(base + name))
    sid = "NIST-SP-800-18r2"
    folder = source_root / sid
    folder.mkdir(parents=True, exist_ok=True)
    current_record = """# Developing Security, Privacy, and Cybersecurity Supply Chain Risk Management Plans for Systems

- **Record ID:** NIST-SP-800-18r2
- **Publisher:** NIST
- **Edition / revision:** NIST SP 800-18 Rev. 2
- **Publication date:** 2026-06-30
- **Authority type:** Federal guidance / voluntary outside federal scope
- **Access / redistribution:** Official public PDF
- **Official URL:** https://doi.org/10.6028/NIST.SP.800-18r2
- **As researched on:** 2026-07-18

## Library note

Current system-planning guidance; supersedes and replaces SP 800-18 Rev. 1, which NIST withdrew on June 30, 2026.

## Verification rule

Use the official NIST publication page and current final PDF. Re-check revision status before relying on this record.
"""
    companion = """# NIST SP 800-18 Rev. 2 — Library Companion Record

## Source classification

**OFFICIAL_PDF_SOURCE**

The linked NIST publication is the controlling source. This record does not reproduce the publication and does not claim NIST endorsement.

## Official source

https://doi.org/10.6028/NIST.SP.800-18r2

## Official PDF

https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-18r2.pdf

## Website use

Use the publication to research original system security, privacy, and cybersecurity supply chain risk management planning companions. Cite exact NIST locators and mark unsupported statements `UNVERIFIED`.
"""
    (folder / "SOURCE_RECORD.md").write_text(current_record, encoding="utf-8")
    (folder / "COMPANION_SOURCE_SUMMARY.md").write_text(companion, encoding="utf-8")
    (folder / "OFFICIAL_SOURCE.url").write_text(
        "[InternetShortcut]\nURL=https://doi.org/10.6028/NIST.SP.800-18r2\n",
        encoding="utf-8",
    )
    records.append(
        {
            "id": sid.lower(),
            "source_id": sid,
            "title": "Developing Security, Privacy, and Cybersecurity Supply Chain Risk Management Plans for Systems",
            "publisher": "NIST",
            "edition": "NIST SP 800-18 Rev. 2",
            "publication_date": "2026-06-30",
            "authority_type": "Federal guidance / voluntary outside federal scope",
            "access": "Official public PDF",
            "status": "OFFICIAL_PDF_DOWNLOAD_READY",
            "category": "nist-governance",
            "official_url": "https://doi.org/10.6028/NIST.SP.800-18r2",
            "direct_pdf_url": "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-18r2.pdf",
            "source_record": f"governance-library/sources/{sid}/SOURCE_RECORD.md",
            "companion_summary": f"governance-library/sources/{sid}/COMPANION_SOURCE_SUMMARY.md",
            "library_note": "Current system-planning guidance; supersedes SP 800-18 Rev. 1.",
            "as_researched_on": "2026-07-18",
            "labels": ["Unofficial companion", "Official source"],
            "prohibited": [
                "invent requirements",
                "claim publisher endorsement",
                "modify an official PDF",
            ],
            "search_text": "nist sp 800 18 rev 2 system security privacy supply chain risk management plans",
        }
    )
    guide_root = root / "governance-library/guides"
    for record in records:
        guide = guide_root / f"{record['source_id']}.md"
        if guide.exists():
            record["public_guide"] = guide.relative_to(root).as_posix()
    catalog = {
        "library_title": "Cybersecurity Governance Source Library",
        "version": "2.1-review",
        "built": "2026-07-18",
        "source_count": len(records),
        "categories": sorted({x["category"] for x in records}),
        "sources": records,
        "featured_companion": {
            "title": "Cybersecurity Governance Framework",
            "path": "governance-library/companions/cybersecurity-governance-framework/README.md",
            "source_matrix": "governance-library/companions/cybersecurity-governance-framework/source-matrix.csv",
            "status": "Review draft 0.1",
        },
    }
    (data_root / "sources.json").write_text(
        json.dumps(catalog, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {"sources": len(records), "categories": len(catalog["categories"])},
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

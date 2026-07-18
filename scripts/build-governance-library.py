"""Build the authoritative governance source catalog from the supplied archive."""
from __future__ import annotations
import argparse, json, re, shutil, zipfile
from pathlib import Path, PurePosixPath

def field(markdown,label):
    m=re.search(rf"^- \*\*{re.escape(label)}:\*\*\s*(.+)$",markdown,re.M)
    return m.group(1).strip() if m else ""

def section(markdown,title):
    m=re.search(rf"^## {re.escape(title)}\s*\n\s*(.+?)(?=\n## |\Z)",markdown,re.M|re.S)
    return " ".join(m.group(1).strip().split()) if m else ""

def category(source_id,title):
    text=f"{source_id} {title}".lower()
    if "hipaa" in text or "45-cfr" in text:return "healthcare-and-hipaa"
    if source_id.startswith("ISO-"):return "iso-standards"
    if "pci" in text:return "payment-security"
    if source_id.startswith("CISA-"):return "cisa-guidance"
    if "privacy" in text:return "privacy"
    if "incident" in text or "ransomware" in text:return "incident-response"
    if "ai-" in text or "42001" in text:return "ai-governance"
    if "sec-" in text or "ftc-" in text:return "regulatory"
    if "53" in text or "fips" in text:return "controls-and-baselines"
    if "risk" in text or "800-30" in text or "800-39" in text:return "risk-management"
    return "nist-governance"

def main():
    p=argparse.ArgumentParser();p.add_argument("archive",type=Path);p.add_argument("--root",type=Path,required=True);args=p.parse_args();root=args.root.resolve()
    source_root=root/"governance-library/sources";data_root=root/"data/governance-library"
    if source_root.exists():shutil.rmtree(source_root)
    source_root.mkdir(parents=True,exist_ok=True);data_root.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(args.archive) as zf:
        bad=zf.testzip()
        if bad:raise SystemExit(f"Archive CRC failure: {bad}")
        base="cybersecurity-governance-library-v2/";manifest=json.loads(zf.read(base+"manifest.json"));records=[]
        for item in manifest:
            sid=item["source_id"];folder=source_root/sid;folder.mkdir(parents=True,exist_ok=True)
            if sid=="NIST-SP-800-18r1":
                shutil.rmtree(folder)
                continue
            prefix=base+sid+"/"
            for info in zf.infolist():
                if info.is_dir() or not info.filename.startswith(prefix):continue
                rel=PurePosixPath(info.filename).relative_to(PurePosixPath(prefix))
                if ".." in rel.parts:raise SystemExit(f"Unsafe archive path: {info.filename}")
                target=folder.joinpath(*rel.parts);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(zf.read(info))
            record_path=folder/"SOURCE_RECORD.md";markdown=record_path.read_text(encoding="utf-8-sig");title=markdown.splitlines()[0].removeprefix("# ").strip()
            authority=field(markdown,"Authority type");access=field(markdown,"Access / redistribution");note=section(markdown,"Library note")
            status=item["status"]
            records.append({
              "id":sid.lower(),"source_id":sid,"title":title,"publisher":field(markdown,"Publisher"),"edition":field(markdown,"Edition / revision"),"publication_date":field(markdown,"Publication date"),"authority_type":authority,"access":access,"status":status,"category":category(sid,title),"official_url":item["official_url"],"direct_pdf_url":item.get("direct_pdf_url"),"source_record":f"governance-library/sources/{sid}/SOURCE_RECORD.md","companion_summary":f"governance-library/sources/{sid}/COMPANION_SOURCE_SUMMARY.md","library_note":note or "Use the official publisher source as the controlling authority.","as_researched_on":item["as_researched_on"],"labels":item["required_labels"],"prohibited":item["prohibited"],"search_text":" ".join([sid,title,field(markdown,"Publisher"),authority,field(markdown,"Edition / revision"),note]).lower()
            })
        for name in ["README.md","manifest.json","manifest.csv"]:(root/"governance-library"/name).write_bytes(zf.read(base+name))
    sid="NIST-SP-800-18r2";folder=source_root/sid;folder.mkdir(parents=True,exist_ok=True)
    current_record="""# Developing Security, Privacy, and Cybersecurity Supply Chain Risk Management Plans for Systems

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
    companion="""# NIST SP 800-18 Rev. 2 — Library Companion Record

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
    (folder/"SOURCE_RECORD.md").write_text(current_record,encoding="utf-8");(folder/"COMPANION_SOURCE_SUMMARY.md").write_text(companion,encoding="utf-8");(folder/"OFFICIAL_SOURCE.url").write_text("[InternetShortcut]\nURL=https://doi.org/10.6028/NIST.SP.800-18r2\n",encoding="utf-8")
    records.append({"id":sid.lower(),"source_id":sid,"title":"Developing Security, Privacy, and Cybersecurity Supply Chain Risk Management Plans for Systems","publisher":"NIST","edition":"NIST SP 800-18 Rev. 2","publication_date":"2026-06-30","authority_type":"Federal guidance / voluntary outside federal scope","access":"Official public PDF","status":"OFFICIAL_PDF_DOWNLOAD_READY","category":"nist-governance","official_url":"https://doi.org/10.6028/NIST.SP.800-18r2","direct_pdf_url":"https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-18r2.pdf","source_record":f"governance-library/sources/{sid}/SOURCE_RECORD.md","companion_summary":f"governance-library/sources/{sid}/COMPANION_SOURCE_SUMMARY.md","library_note":"Current system-planning guidance; supersedes SP 800-18 Rev. 1.","as_researched_on":"2026-07-18","labels":["Unofficial companion","Official source"],"prohibited":["invent requirements","claim publisher endorsement","modify an official PDF"],"search_text":"nist sp 800 18 rev 2 system security privacy supply chain risk management plans"})
    guide_root=root/"governance-library/guides"
    for record in records:
        guide=guide_root/f"{record['source_id']}.md"
        if guide.exists():record["public_guide"]=guide.relative_to(root).as_posix()
    catalog={"library_title":"Cybersecurity Governance Source Library","version":"2.1-review","built":"2026-07-18","source_count":len(records),"categories":sorted({x["category"] for x in records}),"sources":records,"featured_companion":{"title":"Cybersecurity Governance Framework","path":"governance-library/companions/cybersecurity-governance-framework/README.md","source_matrix":"governance-library/companions/cybersecurity-governance-framework/source-matrix.csv","status":"Review draft 0.1"}}
    (data_root/"sources.json").write_text(json.dumps(catalog,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"sources":len(records),"categories":len(catalog["categories"])},indent=2))
if __name__=="__main__":main()

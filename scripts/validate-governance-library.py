"""Validate the authoritative governance catalog and its local source records."""
from __future__ import annotations
import argparse,json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ALLOWED={"nist.gov","www.nist.gov","csrc.nist.gov","nvlpubs.nist.gov","doi.org","cisa.gov","www.cisa.gov","ecfr.gov","www.ecfr.gov","hhs.gov","www.hhs.gov","iso.org","www.iso.org","pcisecuritystandards.org","www.pcisecuritystandards.org","sec.gov","www.sec.gov"}
REQUIRED={"id","source_id","title","publisher","edition","publication_date","authority_type","access","status","category","official_url","source_record","companion_summary","library_note","as_researched_on","labels","prohibited","search_text"}
def main():
    p=argparse.ArgumentParser();p.add_argument("--root",type=Path,required=True);args=p.parse_args();root=args.root.resolve();errors=[];warnings=[]
    catalog=json.loads((root/"data/governance-library/sources.json").read_text(encoding="utf-8"));sources=catalog.get("sources",[])
    for item in sources:
        sid=item.get("source_id","[missing]");missing=REQUIRED-set(item)
        if missing:errors.append(f"{sid}: missing fields {sorted(missing)}")
        for key in ["source_record","companion_summary"]:
            target=(root/item[key]).resolve()
            if root not in target.parents:errors.append(f"{sid}: {key} escapes repository")
            elif not target.exists():errors.append(f"{sid}: missing {key}")
        guide=item.get("public_guide")
        if guide:
            target=(root/guide).resolve()
            if root not in target.parents:errors.append(f"{sid}: public_guide escapes repository")
            elif not target.exists():errors.append(f"{sid}: missing public_guide")
        for key in ["official_url","direct_pdf_url"]:
            value=item.get(key)
            if not value:continue
            parsed=urlparse(value)
            if parsed.scheme!="https":errors.append(f"{sid}: {key} is not HTTPS")
            if parsed.hostname not in ALLOWED:errors.append(f"{sid}: unapproved publisher domain {parsed.hostname}")
        if "LICENSED" in item["status"] and item.get("direct_pdf_url"):errors.append(f"{sid}: licensed source must remain link-only")
        if "official" not in " ".join(item["labels"]).lower():errors.append(f"{sid}: missing official-source label")
    ids=[x["id"] for x in sources];duplicates=[x for x,n in Counter(ids).items() if n>1]
    if duplicates:errors.append(f"Duplicate IDs: {duplicates}")
    if len(sources)!=38:errors.append(f"Expected 38 current sources; found {len(sources)}")
    if any(x["source_id"]=="NIST-SP-800-18r1" for x in sources):errors.append("Withdrawn NIST SP 800-18 Rev. 1 must not be public")
    if not any(x["source_id"]=="NIST-SP-800-18r2" for x in sources):errors.append("Current NIST SP 800-18 Rev. 2 missing")
    featured=catalog.get("featured_companion")
    if not featured:errors.append("Featured companion metadata missing")
    else:
        for key in ["path","source_matrix"]:
            value=featured.get(key)
            if not value:errors.append(f"Featured companion missing {key}");continue
            target=(root/value).resolve()
            if root not in target.parents:errors.append(f"Featured companion {key} escapes repository")
            elif not target.exists():errors.append(f"Featured companion missing {key} file")
    report=["# Governance Source Library Validation","",f"Result: **{'FAIL' if errors else 'PASS'}**","",f"- Current source records: **{len(sources)}**",f"- Public source guides: **{sum(bool(x.get('public_guide')) for x in sources)}**",f"- Categories: **{len(catalog.get('categories',[]))}**",f"- Duplicate IDs: **{len(duplicates)}**",f"- Local record failures: **{sum('missing' in x or 'escapes' in x for x in errors)}**","","## Checks","","- Parsed the generated catalog and enforced required metadata.","- Confirmed every local source record, public guide, and featured companion artifact exists inside the repository.","- Restricted external links to approved authoritative publisher domains over HTTPS.","- Enforced link-only handling for licensed sources.","- Excluded withdrawn NIST SP 800-18 Rev. 1 and required current Rev. 2.","","## Errors","",*([f"- {x}" for x in errors] or ["- None."]),"","## Warnings","",*([f"- {x}" for x in warnings] or ["- None."]),"","## Boundary","","This validation establishes catalog integrity and source-handling rules. Publication revision status and legal applicability must still be rechecked at use time against the linked official source."]
    out=root/"governance-library/VALIDATION.md";out.write_text("\n".join(report)+"\n",encoding="utf-8");print("\n".join(report[:18]));raise SystemExit(bool(errors))
if __name__=="__main__":main()

"""Validate every canonical resource and published library artifact."""
from __future__ import annotations
import argparse, io, json, re, zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from pypdf import PdfReader
import fitz

def main():
    p=argparse.ArgumentParser();p.add_argument("--root",type=Path,required=True);args=p.parse_args();root=args.root.resolve();errors=[];warnings=[];stats=Counter()
    catalog_path=root/"data/resource-library/resources.json"
    try: catalog=json.loads(catalog_path.read_text(encoding="utf-8"))
    except Exception as exc: raise SystemExit(f"Catalog JSON failed: {exc}")
    resources=catalog.get("resources",[]);ids=[];paths=[]
    required={"slug","category","status","title","short_description","purpose","when_to_use","instructions","framework_alignment","version","last_reviewed","disclaimer","copyright_notice","tags","search_keywords","diagram_alt","assets","official_sources"}
    for item in resources:
        rid=item.get("slug","[missing]");ids.append(rid);missing=required-set(item)
        if missing:errors.append(f"{rid}: missing catalog fields {sorted(missing)}")
        if rid!="cia-triad":
            package=root/"resource-library/resources"/item.get("category","")/rid
            for filename in ["metadata.json","README.md","CHANGELOG.md"]:
                if not (package/filename).exists():errors.append(f"{rid}: missing canonical {filename}")
        for role,value in (item.get("assets") or {}).items():
            if not value:continue
            target=(root/value).resolve()
            if root not in target.parents:errors.append(f"{rid}: asset escapes repository: {value}");continue
            if not target.exists():errors.append(f"{rid}: missing {role}: {value}");continue
            paths.append(value);ext=target.suffix.lower();stats[ext]+=1
            try:
                if ext==".xlsx":
                    with zipfile.ZipFile(target) as book:
                        bad=book.testzip();names=set(book.namelist())
                        if bad:errors.append(f"{rid}: XLSX CRC failure {bad}")
                        if "xl/workbook.xml" not in names:errors.append(f"{rid}: XLSX missing workbook.xml")
                        root_xml=ET.fromstring(book.read("xl/workbook.xml")); sheets=root_xml.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet")
                        if not sheets:errors.append(f"{rid}: XLSX has no worksheets")
                        stats["worksheets"]+=len(sheets)
                        if "xl/vbaProject.bin" in names:warnings.append(f"{rid}: macro-enabled content found")
                        if any(n.startswith("xl/externalLinks/") for n in names):warnings.append(f"{rid}: external workbook links found")
                elif ext==".pdf":
                    reader=PdfReader(str(target));stats["pdf_pages"]+=len(reader.pages)
                    if reader.is_encrypted:errors.append(f"{rid}: encrypted PDF")
                    if not reader.pages:errors.append(f"{rid}: PDF has no pages")
                    doc=fitz.open(target)
                    if doc.is_repaired:warnings.append(f"{rid}: {target.name} cross-reference data required parser repair")
                    for number,page in enumerate(doc,1):
                        page.get_pixmap(matrix=fitz.Matrix(.35,.35),alpha=False)
                        for block in page.get_text("blocks"):
                            x0,y0,x1,y1=block[:4]
                            if x0 < -1 or y0 < -1 or x1 > page.rect.width+1 or y1 > page.rect.height+1:errors.append(f"{rid}: PDF page {number} text outside bounds")
                    doc.close()
                elif ext==".svg":
                    svg=target.read_text(encoding="utf-8-sig");node=ET.fromstring(svg)
                    if not node.tag.endswith("svg"):errors.append(f"{rid}: invalid SVG root")
                    if re.search(r"<script\b|javascript:|(?:href|xlink:href)\s*=\s*['\"]https?://",svg,re.I):warnings.append(f"{rid}: SVG contains script or external URL")
            except Exception as exc:errors.append(f"{rid}: {role} validation failed: {exc}")
    duplicate_ids=[x for x,c in Counter(ids).items() if c>1];duplicate_paths=[x for x,c in Counter(paths).items() if c>1]
    if duplicate_ids:errors.append(f"Duplicate catalog IDs: {duplicate_ids}")
    if duplicate_paths:errors.append(f"Assets referenced by multiple resources: {duplicate_paths}")
    if len(resources)!=94:errors.append(f"Expected 94 canonical published resources, found {len(resources)}")
    report=["# Full Library Validation Report","",f"Result: **{'FAIL' if errors else 'PASS'}**","",f"- Catalog resources: **{len(resources)}**",f"- Workbooks: **{stats['.xlsx']}**",f"- Workbook sheets parsed: **{stats['worksheets']}**",f"- PDFs: **{stats['.pdf']}**",f"- PDF pages parsed and rendered: **{stats['pdf_pages']}**",f"- SVG diagrams: **{stats['.svg']}**",f"- Duplicate IDs: **{len(duplicate_ids)}**",f"- Broken/missing asset references: **{sum('missing' in e or 'escapes' in e for e in errors)}**","","## Checks performed","","- Parsed the public catalog and enforced required resource fields.","- Confirmed canonical metadata, README, and changelog files.","- Confirmed every catalog asset stays within and exists in the repository.","- CRC-tested XLSX containers, parsed workbook XML, counted sheets, and checked for macros/external links.","- Parsed every PDF, rejected encryption/empty documents, rasterized every page, and checked text blocks against page bounds.","- Parsed every SVG and scanned for scripts or external URLs.","- Checked resource IDs and published paths for duplicates.","","## Errors","",*([f"- {x}" for x in errors] or ["- None."]),"","## Warnings","",*([f"- {x}" for x in warnings] or ["- None."]),"","## Validation boundary","","Automated rendering proves that pages can rasterize and detects out-of-page text, but it does not replace manual visual review of every imported workbook, PDF, and diagram. Framework accuracy, legal sufficiency, and full accessibility conformance are not certified."]
    output=root/"reports/full-library-validation.md";output.write_text("\n".join(report)+"\n",encoding="utf-8");print("\n".join(report[:18]));raise SystemExit(bool(errors))
if __name__=="__main__":main()

"""Read-only inventory for supplied Joseph Technologies ZIP batches."""
from __future__ import annotations
import argparse, csv, hashlib, io, json, re, zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

RESOURCE_EXTS={".xlsx",".pdf",".svg",".json",".md",".docx",".png",".csv"}
GENERIC={"readme","changelog","manifest","metadata","catalog","index","license","notice"}

def archive_label(name):
    low=name.lower()
    batch=1 if "library-v1" in low else (2 if "set-2" in low else None)
    match=re.search(r"batch-(\d+)",low)
    if match: batch=int(match.group(1))
    part_match=re.search(r"part-(\d+)",low)
    return batch, int(part_match.group(1)) if part_match else None

def resource_key(path):
    stem=Path(path).stem.lower()
    stem=re.sub(r"-(workbook|worksheet|companion-guide|guide|fillable|printable|diagram|metadata|template)$","",stem)
    stem=re.sub(r"[^a-z0-9]+","-",stem).strip("-")
    return "" if stem in GENERIC else stem

def md_table(rows,headers):
    out=["| "+" | ".join(headers)+" |","| "+" | ".join("---" for _ in headers)+" |"]
    out += ["| "+" | ".join(str(row.get(h," ")).replace("|","\\|").replace("\n"," ") for h in headers)+" |" for row in rows]
    return "\n".join(out)

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("archives",type=Path); parser.add_argument("--reports",type=Path,required=True); args=parser.parse_args()
    zips=sorted(args.archives.glob("joseph-technologies*.zip")); args.reports.mkdir(parents=True,exist_ok=True)
    archives=[]; entries=[]; json_issues=[]; id_locations=defaultdict(list); content_locations=defaultdict(list); name_locations=defaultdict(list)
    resource_formats=defaultdict(set); resource_locations=defaultdict(set); manifests=[]
    format_issues=[]; metadata_records=[]; reference_issues=[]
    for zpath in zips:
        batch,part=archive_label(zpath.name); record={"archive":zpath.name,"batch":batch or "?","part":part or "—","bytes":zpath.stat().st_size,"sha256":hashlib.sha256(zpath.read_bytes()).hexdigest(),"status":"PASS","files":0,"dirs":0,"error":""}
        try:
            with zipfile.ZipFile(zpath) as zf:
                bad=zf.testzip()
                if bad: record["status"]="FAIL"; record["error"]=f"CRC failure: {bad}"
                archive_names={Path(i.filename).name.lower() for i in zf.infolist() if not i.is_dir()}
                for info in zf.infolist():
                    if info.is_dir(): record["dirs"]+=1; continue
                    record["files"]+=1; raw=zf.read(info); digest=hashlib.sha256(raw).hexdigest(); suffix=Path(info.filename).suffix.lower(); key=resource_key(info.filename)
                    row={"batch":batch or "","part":part or "","archive":zpath.name,"path":info.filename,"filename":Path(info.filename).name,"extension":suffix,"bytes":info.file_size,"compressed_bytes":info.compress_size,"sha256":digest,"resource_key":key}
                    entries.append(row); content_locations[digest].append((zpath.name,info.filename)); name_locations[Path(info.filename).name.lower()].append((zpath.name,info.filename))
                    if key and suffix in RESOURCE_EXTS: resource_formats[(batch,key)].add(suffix); resource_locations[(batch,key)].add(f"{zpath.name}:{info.filename}")
                    if suffix==".xlsx":
                        try:
                            with zipfile.ZipFile(io.BytesIO(raw)) as book:
                                bad_book=book.testzip(); names=set(book.namelist())
                                if bad_book or not {"[Content_Types].xml","xl/workbook.xml"}.issubset(names): raise ValueError(f"invalid XLSX package; bad={bad_book}")
                                ET.fromstring(book.read("xl/workbook.xml"))
                        except Exception as exc: format_issues.append((zpath.name,info.filename,"XLSX",str(exc)))
                    elif suffix==".pdf" and not raw.startswith(b"%PDF-"):
                        format_issues.append((zpath.name,info.filename,"PDF","missing PDF signature"))
                    elif suffix==".svg":
                        try:
                            root=ET.fromstring(raw)
                            if not root.tag.endswith("svg"): raise ValueError("root element is not SVG")
                        except Exception as exc: format_issues.append((zpath.name,info.filename,"SVG",str(exc)))
                    if suffix==".json":
                        try:
                            data=json.loads(raw.decode("utf-8-sig"))
                            if isinstance(data,dict):
                                rid=data.get("id") or data.get("slug") or data.get("resourceId")
                                if rid:
                                    id_locations[str(rid)].append((zpath.name,info.filename)); metadata_records.append((zpath.name,info.filename,data))
                                    files=data.get("files",{})
                                    if isinstance(files,dict):
                                        for role,ref in files.items():
                                            if isinstance(ref,str) and Path(ref).name.lower() not in archive_names: reference_issues.append((zpath.name,info.filename,str(rid),role,ref))
                                if "manifest" in Path(info.filename).name.lower(): manifests.append((zpath.name,info.filename,data))
                        except Exception as exc: json_issues.append((zpath.name,info.filename,str(exc)))
        except Exception as exc: record["status"]="FAIL"; record["error"]=str(exc)
        archives.append(record)

    duplicates={h:v for h,v in content_locations.items() if len(v)>1}; duplicate_ids={k:v for k,v in id_locations.items() if len(v)>1}
    duplicate_names={k:v for k,v in name_locations.items() if len(v)>1 and len({x[0] for x in v})>1}
    ext_counts=Counter(e["extension"] or "[none]" for e in entries)
    batch_counts=Counter(e["batch"] or "?" for e in entries)
    master=next((a for a in archives if "master-release" in a["archive"]),None)
    expected_parts={7:2,8:2,9:2,10:2,11:2,12:9}; missing_parts=[]
    for batch,total in expected_parts.items():
        found={a["part"] for a in archives if a["batch"]==batch and a["part"]!="—"}
        for part in range(1,total+1):
            if part not in found: missing_parts.append(f"Batch {batch} part {part}")

    with (args.reports/"resource-inventory.csv").open("w",newline="",encoding="utf-8-sig") as fh:
        writer=csv.DictWriter(fh,fieldnames=list(entries[0]) if entries else ["archive"]); writer.writeheader(); writer.writerows(entries)

    inventory=["# Repository Archive Inventory","","Generated by a read-only scan of the supplied ZIP archives. ZIP members were decompressed and CRC-tested without extraction.","",f"- Archives found: **{len(archives)}**",f"- Files inventoried: **{len(entries)}**",f"- Archive integrity failures: **{sum(a['status']!='PASS' for a in archives)}**",f"- JSON parse failures: **{len(json_issues)}**",f"- Unique inferred resource keys: **{len(resource_formats)}**",f"- Duplicate content groups: **{len(duplicates)}**","","## Archives","",md_table(archives,["batch","part","archive","bytes","files","status","error"]),"","## File formats","",md_table([{"extension":k,"count":v} for k,v in sorted(ext_counts.items())],["extension","count"]),"","## Files by batch","",md_table([{"batch":k,"files":v} for k,v in sorted(batch_counts.items(),key=lambda x:str(x[0]))],["batch","files"]),"","The complete file-level inventory, including SHA-256 values, is in `resource-inventory.csv`."]
    (args.reports/"repository-inventory.md").write_text("\n".join(inventory)+"\n",encoding="utf-8")

    required_fields={"id","title","summary","category","batch","part","version","releaseDate","publisher","sampleData","formats","files","keywords","intendedAudience","status"}
    metadata_missing=[]
    for archive,path,data in metadata_records:
        missing=sorted(required_fields-set(data))
        if missing: metadata_missing.append((archive,path,str(data.get("id")),missing))
    findings=["# Structure Findings","","## Executive findings",""]
    findings += [f"- **Archive integrity:** {sum(a['status']=='PASS' for a in archives)} of {len(archives)} archives passed CRC/decompression checks.",f"- **Batch sequence:** provisional Batch 1 plus Batches 2–12 were detected. Expected split parts missing: {', '.join(missing_parts) if missing_parts else 'none' }.",f"- **Batch 12 master release:** {master['files'] if master else 0} files / {master['bytes'] if master else 0} bytes. This is {'not large enough to contain all nine component archives and should be treated as a release index/documentation package' if master and master['bytes']<sum(a['bytes'] for a in archives if a['batch']==12 and a['part']!='—') else 'potentially a combined release'}.",f"- **JSON syntax:** {len(json_issues)} invalid JSON files.",f"- **Duplicate IDs:** {len(duplicate_ids)} IDs occur in multiple locations; exact duplicate packages may account for some repeats.",f"- **Repeated filenames:** {len(duplicate_names)} filenames appear across multiple archives.",f"- **Exact duplicate content:** {len(duplicates)} SHA-256 groups contain more than one file.","","## JSON issues","",*( [f"- `{a}` → `{p}`: {e}" for a,p,e in json_issues] or ["- None."] ),"","## Duplicate resource IDs","",*( [f"- `{rid}`: "+"; ".join(f"{a}:{p}" for a,p in locs) for rid,locs in sorted(duplicate_ids.items())] or ["- None detected."] ),"","## Companion-format observations","","The following table uses normalized filenames as a preliminary resource heuristic. It is not a final classification; README and manifest semantics must be considered before migration.",""]
    findings += ["","## Deep file and metadata validation","",f"- Invalid XLSX/PDF/SVG containers: **{len(format_issues)}**",f"- Missing metadata-referenced companion files: **{len(reference_issues)}**",f"- ID-bearing metadata records missing one or more proposed future fields: **{len(metadata_missing)} of {len(metadata_records)}**","","The proposed AGENTS.md metadata contract is stricter than the supplied batch schemas. Missing fields require normalization, but do not by themselves mean the underlying resource file is corrupt.","","### File-container issues","",*( [f"- `{kind}` `{a}` → `{p}`: {e}" for a,p,kind,e in format_issues] or ["- None."] ),"","### Broken metadata file references","",*( [f"- `{rid}` ({a}:{p}) references missing `{role}` file `{ref}`" for a,p,rid,role,ref in reference_issues] or ["- None."] ),"","### Metadata normalization requirements","",md_table([{"id":rid,"archive":a,"path":p,"missing":", ".join(m)} for a,p,rid,m in metadata_missing],["id","archive","path","missing"])]
    resource_rows=[]
    for (batch,key),formats in sorted(resource_formats.items(),key=lambda x:(str(x[0][0]),x[0][1])):
        expected={".json"}; missing=expected-formats
        resource_rows.append({"batch":batch or "?","resource":key,"formats":", ".join(sorted(formats)),"metadata":"missing" if missing else "present"})
    findings.append(md_table(resource_rows,["batch","resource","formats","metadata"]))
    findings += ["","## Structural risks","","- Batch/part folders are useful provenance but are not an ideal permanent public-resource hierarchy.","- Identical files repeated in part archives and release packages must not be published twice.","- Metadata exists at different scopes; a canonical resource record must be selected before generating website catalogs.","- Workbook, guide, diagram, and metadata relationships must be established from manifests and resource IDs, not filenames alone.","- No archive should be classified as verified merely because it opens; companion completeness, metadata semantics, and internal references require a second-stage extracted audit."]
    (args.reports/"structure-findings.md").write_text("\n".join(findings)+"\n",encoding="utf-8")

    plan='''# Proposed Migration Plan

## Decision

Keep the existing `my-website` repository as the deployable GitHub Pages site. Preserve received archives as intake provenance, then normalize approved resources into resource-level canonical packages. Do not create a second, duplicated `website/` application tree.

## Canonical layers

1. **Intake:** immutable batch/part contents and archive checksums.
2. **Canonical source:** one directory per resource containing metadata, workbook, guide, diagrams, README, changelog, and optional source content.
3. **Generated catalog:** website-facing JSON derived from canonical metadata.
4. **Published assets:** approved `.xlsx`, `.pdf`, `.svg`, and optional `.png` files under `assets/resources/`.
5. **Archive:** deprecated and replaced versions retained with migration records.

## Safe execution sequence

1. Approve this inventory and canonical structure.
2. Copy—not move—the ZIP archives into `intake/archives/` and record SHA-256 checksums.
3. Extract each archive into an isolated staging directory with path-traversal and collision checks.
4. Reconcile master/part duplication and establish authoritative versions.
5. Validate JSON schemas, IDs, file references, XLSX packages, PDFs, SVG XML, and licensing/originality language.
6. Create resource-level packages without changing public IDs.
7. Generate catalogs and search data from canonical metadata.
8. Publish only resources that pass validation; mark incomplete packages as draft.
9. Extend the existing `/resources/` interface around the verified catalog.
10. Run link, download, responsive, accessibility, and document-render tests before deployment.

## Proposed canonical resource package

```text
resource-library/resources/<category>/<resource-id>/
├── README.md
├── CHANGELOG.md
├── metadata.json
├── source/
├── workbook/
├── guide/
└── diagrams/
```

## Approval boundary

This report does not authorize deleting, renaming, or overwriting received resources. Migration should begin only after the inventory findings and treatment of duplicates/incomplete packages are approved.
'''
    (args.reports/"proposed-migration-plan.md").write_text(plan,encoding="utf-8")
    print(json.dumps({"archives":len(archives),"files":len(entries),"archive_failures":sum(a['status']!='PASS' for a in archives),"json_issues":len(json_issues),"format_issues":len(format_issues),"broken_references":len(reference_issues),"incomplete_metadata":len(metadata_missing),"metadata_records":len(metadata_records),"duplicate_ids":len(duplicate_ids),"duplicate_content_groups":len(duplicates),"resources_inferred":len(resource_formats)},indent=2))

if __name__=="__main__": main()

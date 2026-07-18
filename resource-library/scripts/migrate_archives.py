"""Normalize verified archive packages into the existing static library."""
from __future__ import annotations
import argparse, hashlib, json, re, shutil, zipfile
from pathlib import Path, PurePosixPath

def label(name):
    low=name.lower(); batch=1 if "library-v1" in low else (2 if "set-2" in low else 0)
    m=re.search(r"batch-(\d+)",low)
    if m: batch=int(m.group(1))
    p=re.search(r"part-(\d+)",low)
    return batch,int(p.group(1)) if p else 0

def slug(value): return re.sub(r"[^a-z0-9]+","-",str(value).lower()).strip("-")

def file_resource_id(filename):
    value=slug(Path(filename).stem)
    return re.sub(r"-(workbook|worksheet|companion-guide|guide|fillable|printable|diagram|metadata|template)$","",value)

def category_for(item,batch):
    if item.get("category"): return slug(item["category"])
    rid=item["id"]
    explicit={
      "aaa-access-review":"security-models","bell-lapadula-access-matrix":"security-models","biba-integrity-assessment":"security-models","cybersecurity-risk-register":"risk-management","nist-csf-2-planning-companion":"risk-management",
      "privacy-impact-assessment":"privacy","vendor-security-review":"compliance","digital-evidence-chain-of-custody":"governance","digital-asset-inventory":"governance","incident-response-command":"incident-response",
      "attack-tree-builder":"security-models","defense-in-depth-planner":"architecture","dread-risk-analysis-toolkit":"risk-management","stride-threat-modeling-toolkit":"security-models","zero-trust-architecture-planner":"architecture"
    }
    if rid in explicit:return explicit[rid]
    return {5:"security-operations",6:"incident-response",7:"architecture",8:"compliance",9:"risk-management",10:"secure-development",11:"security-operations"}.get(batch,"governance")

def read_records(archives):
    records=[]
    for zpath in sorted(archives.glob("joseph-technologies*.zip")):
        batch,part=label(zpath.name)
        with zipfile.ZipFile(zpath) as zf:
            by_name={PurePosixPath(i.filename).name.lower():i for i in zf.infolist() if not i.is_dir()}
            for info in zf.infolist():
                if info.is_dir() or not info.filename.lower().endswith(".json"): continue
                try:data=json.loads(zf.read(info).decode("utf-8-sig"))
                except Exception:continue
                if not isinstance(data,dict) or not data.get("id"):continue
                if isinstance(data.get("files"),dict):
                    refs={role:by_name.get(PurePosixPath(ref).name.lower()) for role,ref in data["files"].items() if isinstance(ref,str)}
                elif batch>=2 and isinstance(data.get("files"),list):
                    refs={}
                    for ref in data["files"]:
                        if not isinstance(ref,str): continue
                        ext=Path(ref).suffix.lower(); role={".xlsx":"workbook",".pdf":"pdf",".svg":"diagram"}.get(ext,ext.lstrip(".")); refs[role]=by_name.get(PurePosixPath(ref).name.lower())
                elif batch>=2 and isinstance(data.get("outputs"),list):
                    refs={}
                    for ext in data["outputs"]:
                        ext="."+str(ext).lstrip(".").lower()
                        candidates=[i for i in zf.infolist() if not i.is_dir() and Path(i.filename).suffix.lower()==ext and (file_resource_id(i.filename)==str(data["id"]) or slug(Path(i.filename).stem)==str(data["id"]))]
                        if len(candidates)==1: refs[{".xlsx":"workbook",".pdf":"pdf",".svg":"diagram"}.get(ext,ext.lstrip("."))]=candidates[0]
                else: continue
                if not all(refs.values()):continue
                if not {"workbook","pdf","diagram"}.issubset(refs):continue
                records.append({"id":str(data["id"]),"data":data,"archive":zpath,"archive_name":zpath.name,"metadata_path":info.filename,"batch":batch,"part":part,"refs":refs})
    return records

def main():
    p=argparse.ArgumentParser();p.add_argument("archives",type=Path);p.add_argument("--root",type=Path,required=True);args=p.parse_args();root=args.root.resolve()
    records=read_records(args.archives); chosen={}; superseded=[]
    for record in records:
        old=chosen.get(record["id"])
        if not old or (record["batch"],record["part"],record["archive_name"])>(old["batch"],old["part"],old["archive_name"]):
            if old:superseded.append(old)
            chosen[record["id"]]=record
        else:superseded.append(record)
    catalog_path=root/"data/resource-library/resources.json"; catalog=json.loads(catalog_path.read_text(encoding="utf-8")); cia=next(x for x in catalog["resources"] if x["slug"]=="cia-triad")
    public={"workbook":root/"assets/resources/workbooks","pdf":root/"assets/resources/pdf","diagram":root/"assets/resources/diagrams"}
    for folder in public.values():folder.mkdir(parents=True,exist_ok=True)
    canonical=root/"resource-library/resources"; migration=[]; resources=[cia]
    for rid,record in sorted(chosen.items(),key=lambda x:(x[1]["batch"],x[1]["part"],x[0])):
        data=record["data"]; category=category_for(data,record["batch"]); assets={"printable_pdf":None,"fillable_pdf":None,"diagram_svg":None,"diagram_png":None,"workbook":None}
        copied={}
        with zipfile.ZipFile(record["archive"]) as zf:
            for role,info in record["refs"].items():
                ext=Path(info.filename).suffix.lower(); target_folder=public.get("workbook" if ext==".xlsx" else "pdf" if ext==".pdf" else "diagram" if ext==".svg" else "")
                if not target_folder:continue
                filename=f"{rid}{ext}"; target=target_folder/filename; target.write_bytes(zf.read(info)); rel=target.relative_to(root).as_posix();copied[role]=rel
                if ext==".xlsx":assets["workbook"]=rel
                elif ext==".pdf":assets["printable_pdf"]=rel
                elif ext==".svg":assets["diagram_svg"]=rel
        framework=data.get("frameworkAlignment") or data.get("framework_alignment") or []
        if isinstance(framework,str):framework=[framework]
        summary=data.get("summary") or f"Original Joseph Technologies companion resource for {data.get('title',rid)}."
        normalized={"slug":rid,"category":category,"status":"published","title":data.get("title",rid.replace("-"," ").title()),"short_description":summary,"purpose":data.get("purpose") or summary,"when_to_use":data.get("whenToUse") or "Use during the relevant cybersecurity planning, assessment, review, or operational workflow.","instructions":data.get("instructions") or ["Download the workbook or guide.","Define the scope and responsible owner before entering information.","Review decisions against current official guidance and organizational requirements."],"framework_alignment":framework,"version":data.get("version","1.0.0"),"last_reviewed":data.get("reviewDate") or data.get("releaseDate") or "2026-07-18","disclaimer":data.get("notice") or "Original Joseph Technologies educational companion material. It is not an official standards-body publication, certification, legal opinion, or guarantee of compliance or security.","copyright_notice":"© 2026 Joseph Technologies. Original companion material; referenced framework names belong to their respective owners.","tags":[category,rid],"search_keywords":[w for w in rid.split("-") if len(w)>2],"diagram_alt":f"Original companion diagram for {data.get('title',rid)}.","assets":assets,"official_sources":[],"provenance":{"batch":record["batch"],"part":record["part"] or None,"archive":record["archive_name"],"archive_sha256":hashlib.sha256(record["archive"].read_bytes()).hexdigest(),"metadata_path":record["metadata_path"],"source_files":copied}}
        package=canonical/category/rid;package.mkdir(parents=True,exist_ok=True);(package/"metadata.json").write_text(json.dumps(normalized,indent=2)+"\n",encoding="utf-8")
        (package/"README.md").write_text(f"# {normalized['title']}\n\n{summary}\n\nImported from Batch {record['batch']}"+(f", Part {record['part']}" if record['part'] else "")+f". See `metadata.json` for provenance and public-file references.\n",encoding="utf-8")
        (package/"CHANGELOG.md").write_text(f"# Changelog\n\n## {normalized['version']} — {normalized['last_reviewed']}\n\n- Imported from the verified source archive without altering the workbook, PDF, or SVG bytes.\n",encoding="utf-8")
        resources.append(normalized);migration.append({"id":rid,"category":category,"batch":record["batch"],"part":record["part"] or "","archive":record["archive_name"],"status":"published"})
    catalog["library_version"]="2.0.0";catalog["generated"]="2026-07-18";catalog["categories"]=sorted({r["category"] for r in resources});catalog["resources"]=resources;catalog_path.write_text(json.dumps(catalog,indent=2)+"\n",encoding="utf-8")
    report=["# Canonical Migration Record","",f"- Published resources: **{len(resources)}**",f"- Imported archive packages: **{len(migration)}**",f"- Existing CIA prototype retained: **1**",f"- Superseded duplicate packages retained only in original ZIPs: **{len(superseded)}**","","| ID | Category | Batch | Part | Archive | Status |","| --- | --- | --- | --- | --- | --- |"]+[f"| {x['id']} | {x['category']} | {x['batch']} | {x['part']} | {x['archive']} | {x['status']} |" for x in migration]+["","## Superseded duplicate IDs",""]+([f"- `{x['id']}` from `{x['archive_name']}`; a later batch/part is canonical." for x in superseded] or ["- None."])
    reports=root/"reports";reports.mkdir(exist_ok=True);(reports/"canonical-migration-record.md").write_text("\n".join(report)+"\n",encoding="utf-8")
    print(json.dumps({"published":len(resources),"imported":len(migration),"superseded":len(superseded)},indent=2))
if __name__=="__main__":main()

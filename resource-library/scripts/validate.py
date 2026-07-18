from pathlib import Path
import json, sys
from jsonschema import Draft202012Validator
from pypdf import PdfReader
import fitz

ROOT=Path(__file__).resolve().parents[2]
REPORT_DIR=ROOT/"output/resource-library"
SCHEMA=json.loads((ROOT/"resource-library/schema/resource.schema.json").read_text(encoding="utf-8"))
SOURCE=json.loads((ROOT/"resource-library/resources/cia-triad.json").read_text(encoding="utf-8"))
PDFS=[ROOT/"assets/resources/pdf/cia-triad-asset-assessment.pdf",ROOT/"assets/resources/pdf/cia-triad-asset-assessment-fillable.pdf"]

def fail(message, errors): errors.append(message)
def main():
    errors=[]; notes=[]; REPORT_DIR.mkdir(parents=True,exist_ok=True)
    schema_errors=list(Draft202012Validator(SCHEMA).iter_errors(SOURCE))
    for error in schema_errors: fail(f"Schema: {error.message}",errors)
    for pdf in PDFS:
        if not pdf.exists(): fail(f"Missing {pdf}",errors); continue
        reader=PdfReader(str(pdf)); notes.append(f"{pdf.name}: {len(reader.pages)} pages")
        if len(reader.pages)!=3: fail(f"{pdf.name}: expected 3 pages",errors)
        for index,page in enumerate(reader.pages,1):
            width=float(page.mediabox.width); height=float(page.mediabox.height)
            if abs(width-612)>1 or abs(height-792)>1: fail(f"{pdf.name} page {index}: not US Letter ({width}x{height})",errors)
        fields=reader.get_fields() or {}; notes.append(f"{pdf.name}: {len(fields)} interactive fields")
        if "fillable" in pdf.name:
            required={"assessment_date","asset_name","asset_description","confidentiality_rating","integrity_rating","availability_rating","review_date"}
            missing=required-set(fields); 
            if missing: fail(f"Fillable PDF missing fields: {sorted(missing)}",errors)
            if len(fields)<25: fail(f"Fillable PDF has too few interactive fields ({len(fields)})",errors)
        elif fields: fail("Printable PDF unexpectedly contains interactive fields",errors)
        doc=fitz.open(pdf); folder=REPORT_DIR/pdf.stem; folder.mkdir(exist_ok=True)
        for index,page in enumerate(doc):
            pix=page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False); pix.save(folder/f"page-{index+1}.png")
            blocks=page.get_text("blocks")
            for block in blocks:
                x0,y0,x1,y1=block[:4]
                if x0 < -1 or y0 < -1 or x1 > page.rect.width+1 or y1 > page.rect.height+1: fail(f"{pdf.name} page {index+1}: text block outside page",errors)
        doc.close()
    catalog=json.loads((ROOT/"data/resource-library/resources.json").read_text(encoding="utf-8")); published=[i for i in catalog["resources"] if i["status"]=="published"]
    if [i["slug"] for i in published] != ["cia-triad"]: fail("Prototype must publish only CIA Triad",errors)
    report=["# CIA Triad validation report","",f"Result: {'FAIL' if errors else 'PASS'}","","## Automated checks",""]+[f"- {note}" for note in notes]+["- JSON Schema validation completed.","- Every PDF page was checked for US Letter dimensions.","- PDF form dictionaries and required descriptive field names were inspected.","- Text blocks were checked against page bounds.","- Every page was rasterized with PyMuPDF for visual inspection.","- Catalog publication state was checked (CIA Triad only).","","## Tooling","","Structural checks used pypdf and visual rendering used PyMuPDF; qpdf/Poppler were not available on this machine.","","## Errors",""]+([f"- {e}" for e in errors] if errors else ["- None."])
    (REPORT_DIR/"VALIDATION.md").write_text("\n".join(report)+"\n",encoding="utf-8")
    print("\n".join(report)); raise SystemExit(bool(errors))
if __name__=="__main__": main()

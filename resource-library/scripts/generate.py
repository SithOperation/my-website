from pathlib import Path
import json, sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor, white

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "resource-library/resources/cia-triad.json"
PDF_DIR = ROOT / "assets/resources/pdf"
SVG_DIR = ROOT / "assets/resources/diagrams"
W, H = letter
INK, MUTED, RED, TAN, PANEL, LINE = map(HexColor, ["#252724", "#565a55", "#a72c2c", "#8b794d", "#f1f0ea", "#b6b8b1"])
MARGIN = 46

def header(c, data, page, subtitle):
    c.setFillColor(INK); c.rect(0, H-62, W, 62, fill=1, stroke=0)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 11); c.drawString(MARGIN, H-28, "JOSEPH TECHNOLOGIES")
    c.setFillColor(TAN); c.setFont("Courier-Bold", 7.5); c.drawRightString(W-MARGIN, H-28, "CYBERSECURITY RESOURCE LIBRARY")
    c.setFillColor(white); c.setFont("Helvetica", 8); c.drawString(MARGIN, H-45, subtitle)
    c.setFillColor(MUTED); c.setFont("Helvetica", 7); c.drawString(MARGIN, 26, f"Original companion material  |  Version {data['version']}  |  Reviewed {data['last_reviewed']}")
    c.drawRightString(W-MARGIN, 26, f"Page {page} of 3")
    c.setStrokeColor(RED); c.setLineWidth(1.5); c.line(MARGIN, 36, W-MARGIN, 36)

def label(c, text, x, y):
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 8); c.drawString(x, y, text)

def line_field(c, form, name, x, y, width, fillable, height=18, multiline=False):
    c.setStrokeColor(LINE); c.setFillColor(white); c.rect(x, y-height, width, height, fill=1, stroke=1)
    if fillable:
        flags = 4096 if multiline else 0
        form.textfield(name=name, tooltip=name.replace("_", " ").title(), x=x+1, y=y-height+1, width=width-2, height=height-2, borderWidth=0, fillColor=white, textColor=INK, fontName="Helvetica", fontSize=8, fieldFlags=flags)

def rating(c, form, prefix, y, fillable):
    label(c, "Impact rating", MARGIN, y)
    x = MARGIN+88
    for value in ["Low", "Moderate", "High"]:
        c.setStrokeColor(INK); c.rect(x, y-8, 9, 9, fill=0, stroke=1); c.setFont("Helvetica", 8); c.setFillColor(INK); c.drawString(x+14, y-7, value)
        if fillable: form.radio(name=f"{prefix}_rating", value=value.lower(), tooltip=f"{prefix.title()} impact rating: {value}", x=x, y=y-8, size=9, buttonStyle="check", selected=False, borderWidth=0)
        x += 100

def title(c, text, y):
    c.setFillColor(RED); c.setFont("Courier-Bold", 8); c.drawString(MARGIN, y+17, "ASSESSMENT WORKSHEET")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 22); c.drawString(MARGIN, y, text)

def build_pdf(path, data, fillable):
    c = canvas.Canvas(str(path), pagesize=letter, pageCompression=1); c.setTitle(data["title"]); c.setAuthor("Joseph Technologies")
    form = c.acroForm
    header(c,data,1,"CIA Triad Asset Assessment — Asset profile"); title(c,"Asset profile", H-98)
    c.setFillColor(MUTED); c.setFont("Helvetica",8); c.drawString(MARGIN,H-118,"Complete one worksheet per asset. Use concise, evidence-based statements; attach supporting records separately.")
    y=H-150
    for lab,name,x,w in [("Assessment date","assessment_date",MARGIN,150),("Assessor name","assessor_name",MARGIN+170,350)]: label(c,lab,x,y); line_field(c,form,name,x,y-6,w,fillable)
    y-=52
    for lab,name,x,w in [("Asset name","asset_name",MARGIN,250),("Asset owner","asset_owner",MARGIN+270,250)]: label(c,lab,x,y); line_field(c,form,name,x,y-6,w,fillable)
    y-=52; label(c,"Asset type (check all that apply)",MARGIN,y); x=MARGIN
    for value in ["Data","Application","Service","Device","Facility","Other"]:
        c.rect(x,y-25,9,9,stroke=1,fill=0); c.setFont("Helvetica",8); c.drawString(x+14,y-24,value)
        if fillable: form.checkbox(name=f"asset_type_{value.lower()}",tooltip=f"Asset type: {value}",x=x,y=y-25,size=9,buttonStyle="check",borderWidth=0)
        x+=82
    y-=54; label(c,"Business process supported",MARGIN,y); line_field(c,form,"business_process",MARGIN,y-6,W-2*MARGIN,fillable)
    y-=57; label(c,"Asset description, location, users, dependencies, and data handled",MARGIN,y); line_field(c,form,"asset_description",MARGIN,y-6,W-2*MARGIN,fillable,76,True)
    y-=106; label(c,"Initial impact overview — what happens if this asset is exposed, changed, or unavailable?",MARGIN,y); line_field(c,form,"impact_overview",MARGIN,y-6,W-2*MARGIN,fillable,92,True)
    c.setFillColor(PANEL); c.rect(MARGIN,55,W-2*MARGIN,52,fill=1,stroke=0); c.setFillColor(INK); c.setFont("Helvetica-Bold",7.5); c.drawString(MARGIN+10,94,"HANDLING NOTE")
    c.setFont("Helvetica",7.2); c.drawString(MARGIN+10,80,"Do not place passwords, secrets, regulated data, or active incident evidence in this worksheet.")
    c.drawString(MARGIN+10,67,"Store the completed assessment according to your organization's information-handling requirements.")
    c.showPage()
    header(c,data,2,"CIA Triad Asset Assessment — Security objectives"); title(c,"Security objectives",H-98)
    c.setFillColor(MUTED); c.setFont("Helvetica",8); c.drawString(MARGIN,H-118,"Rate business impact, explain the scenario, and identify safeguards or gaps for each objective.")
    y=H-150
    for heading,prefix,prompt in [("01 / CONFIDENTIALITY","confidentiality","Who must be prevented from seeing or disclosing the asset?"),("02 / INTEGRITY","integrity","What unauthorized or accidental change would make the asset untrustworthy?"),("03 / AVAILABILITY","availability","How long can the asset be unavailable before business harm becomes unacceptable?")]:
        c.setFillColor(INK); c.setFont("Helvetica-Bold",11); c.drawString(MARGIN,y,heading); rating(c,form,prefix,y-24,fillable)
        label(c,prompt,MARGIN,y-50); line_field(c,form,f"{prefix}_impact",MARGIN,y-56,W-2*MARGIN,fillable,58,True)
        label(c,"Existing safeguards, evidence, and priority gaps",MARGIN,y-128); line_field(c,form,f"{prefix}_controls",MARGIN,y-134,W-2*MARGIN,fillable,48,True)
        y-=198
    c.showPage()
    header(c,data,3,"CIA Triad Asset Assessment — Control action plan"); title(c,"Control action plan",H-98)
    y=H-145; label(c,"Highest-priority objective",MARGIN,y); x=MARGIN+135
    for value in ["Confidentiality","Integrity","Availability","Balanced"]:
        c.rect(x,y-8,9,9,stroke=1,fill=0); c.setFont("Helvetica",8); c.drawString(x+14,y-7,value)
        if fillable: form.radio(name="priority_objective",value=value.lower(),tooltip=f"Priority objective: {value}",x=x,y=y-8,size=9,buttonStyle="check",borderWidth=0)
        x+=105
    y-=39; label(c,"Risk and priority summary",MARGIN,y); line_field(c,form,"risk_summary",MARGIN,y-6,W-2*MARGIN,fillable,62,True)
    y-=94; c.setFillColor(INK); c.setFont("Helvetica-Bold",11); c.drawString(MARGIN,y,"CONTROL ACTIONS")
    y-=18
    for n in [1,2]:
        label(c,f"Action {n} — specific safeguard or decision",MARGIN,y); line_field(c,form,f"action_{n}",MARGIN,y-6,W-2*MARGIN,fillable,46,True); y-=65
        label(c,"Owner",MARGIN,y); line_field(c,form,f"action_{n}_owner",MARGIN,y-6,280,fillable); label(c,"Target date",MARGIN+300,y); line_field(c,form,f"action_{n}_date",MARGIN+300,y-6,180,fillable); y-=51
    label(c,"Review notes and accepted constraints",MARGIN,y); line_field(c,form,"review_notes",MARGIN,y-6,W-2*MARGIN,fillable,58,True); y-=86
    for lab,name,x,w in [("Asset owner acknowledgement","asset_owner_acknowledgement",MARGIN,220),("Reviewer name","reviewer_name",MARGIN+240,170),("Review date","review_date",MARGIN+430,90)]: label(c,lab,x,y); line_field(c,form,name,x,y-6,w,fillable)
    c.setFillColor(PANEL); c.rect(MARGIN,55,W-2*MARGIN,48,fill=1,stroke=0); c.setFillColor(INK); c.setFont("Helvetica",6.7)
    c.drawString(MARGIN+10,88,"Original Joseph Technologies companion material. Not an official NIST form; no standards-body endorsement or certification is implied.")
    c.drawString(MARGIN+10,76,"This worksheet is not legal, regulatory, audit, or compliance advice. Validate decisions against applicable requirements and current official guidance.")
    c.drawString(MARGIN+10,64,"Framework names belong to their respective owners. © 2026 Joseph Technologies.")
    c.save()

def build_svg(path):
    path.write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 540" role="img" aria-labelledby="title desc"><title id="title">CIA Triad Asset Assessment</title><desc id="desc">Confidentiality, integrity, and availability panels connect to a protected information asset.</desc><rect width="900" height="540" fill="#090a0a"/><g fill="none" stroke="#777a77" stroke-width="3"><path d="M255 185L390 260M645 185L510 260M450 405V330"/></g><g font-family="Segoe UI,Arial,sans-serif"><g><rect x="70" y="75" width="300" height="130" fill="#171817" stroke="#a72c2c" stroke-width="3"/><text x="95" y="112" fill="#c8b98f" font-size="14" font-weight="700" letter-spacing="2">01 / CONFIDENTIALITY</text><text x="95" y="148" fill="#e4e4dc" font-size="20">Prevent unauthorized disclosure</text><text x="95" y="178" fill="#a5a69f" font-size="15">Access • handling • privacy</text></g><g><rect x="530" y="75" width="300" height="130" fill="#171817" stroke="#a72c2c" stroke-width="3"/><text x="555" y="112" fill="#c8b98f" font-size="14" font-weight="700" letter-spacing="2">02 / INTEGRITY</text><text x="555" y="148" fill="#e4e4dc" font-size="20">Prevent improper alteration</text><text x="555" y="178" fill="#a5a69f" font-size="15">Accuracy • trust • provenance</text></g><g><rect x="300" y="355" width="300" height="130" fill="#171817" stroke="#a72c2c" stroke-width="3"/><text x="325" y="392" fill="#c8b98f" font-size="14" font-weight="700" letter-spacing="2">03 / AVAILABILITY</text><text x="325" y="428" fill="#e4e4dc" font-size="20">Maintain reliable access</text><text x="325" y="458" fill="#a5a69f" font-size="15">Resilience • recovery • capacity</text></g><circle cx="450" cy="280" r="86" fill="#232422" stroke="#e4e4dc" stroke-width="3"/><text x="450" y="270" fill="#c8b98f" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="2">PROTECTED</text><text x="450" y="303" fill="#e4e4dc" text-anchor="middle" font-size="25" font-weight="700">ASSET</text></g></svg>''', encoding="utf-8")

def main():
    data=json.loads(SOURCE.read_text(encoding="utf-8")); PDF_DIR.mkdir(parents=True,exist_ok=True); SVG_DIR.mkdir(parents=True,exist_ok=True)
    build_pdf(PDF_DIR/"cia-triad-asset-assessment.pdf",data,False); build_pdf(PDF_DIR/"cia-triad-asset-assessment-fillable.pdf",data,True); build_svg(SVG_DIR/"cia-triad.svg")
    print("Generated CIA Triad printable PDF, fillable PDF, and SVG")
if __name__ == "__main__": main()

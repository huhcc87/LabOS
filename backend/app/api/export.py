"""
Export endpoints — serve data as Excel (.xlsx), CSV, or PDF.

All endpoints require a valid JWT bearer token.
Pandas + openpyxl handle spreadsheet generation.
ReportLab handles PDF generation for ELN entries.
"""

import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    InventoryItem,
    LabNotebookEntry,
    SampleRecord,
    GrantSubmission,
    PurchaseOrder,
    TrainingRecord,
    CapaRecord,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/export", tags=["export"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_MIME  = "text/csv"
PDF_MIME  = "application/pdf"


def _xlsx_response(df, filename: str) -> Response:
    buf = io.BytesIO()
    df.to_excel(buf, index=False, engine="openpyxl")
    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _csv_response(df, filename: str) -> Response:
    return Response(
        content=df.to_csv(index=False),
        media_type=CSV_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Inventory ───────────────────────────────────────────────────────────────

@router.get("/inventory.xlsx")
def export_inventory_xlsx(db: Session = Depends(get_db), _=Depends(get_current_user)):
    import pandas as pd
    rows = db.query(InventoryItem).all()
    data = [
        {
            "ID": r.id,
            "Name": r.name,
            "SKU": getattr(r, "sku", ""),
            "Category": getattr(r, "category", ""),
            "Quantity": r.quantity,
            "Unit": r.unit,
            "Low Stock Threshold": r.low_stock_threshold,
            "Location": r.location,
            "Expires On": str(getattr(r, "expires_on", "") or ""),
            "Lot Number": getattr(r, "lot_number", "") or "",
            "Supplier": getattr(r, "supplier_name", "") or "",
            "Notes": getattr(r, "notes", "") or "",
        }
        for r in rows
    ]
    return _xlsx_response(pd.DataFrame(data), f"inventory_{datetime.now().strftime('%Y%m%d')}.xlsx")


@router.get("/inventory.csv")
def export_inventory_csv(db: Session = Depends(get_db), _=Depends(get_current_user)):
    import pandas as pd
    rows = db.query(InventoryItem).all()
    data = [
        {
            "ID": r.id, "Name": r.name, "Quantity": r.quantity,
            "Unit": r.unit, "Location": r.location,
            "Low Stock Threshold": r.low_stock_threshold,
        }
        for r in rows
    ]
    return _csv_response(pd.DataFrame(data), f"inventory_{datetime.now().strftime('%Y%m%d')}.csv")


# ─── Samples ─────────────────────────────────────────────────────────────────

@router.get("/samples.xlsx")
def export_samples_xlsx(db: Session = Depends(get_db), _=Depends(get_current_user)):
    import pandas as pd
    rows = db.query(SampleRecord).all()
    data = [
        {
            "ID": r.id,
            "Barcode": r.barcode,
            "Name": r.name,
            "Type": getattr(r, "sample_type", ""),
            "Status": r.status,
            "Storage Location": getattr(r, "storage_location", "") or "",
            "Collected By": getattr(r, "collected_by_name", "") or "",
            "Collected On": str(getattr(r, "collected_on", "") or ""),
            "Notes": getattr(r, "notes", "") or "",
        }
        for r in rows
    ]
    return _xlsx_response(pd.DataFrame(data), f"samples_{datetime.now().strftime('%Y%m%d')}.xlsx")


@router.get("/samples.csv")
def export_samples_csv(db: Session = Depends(get_db), _=Depends(get_current_user)):
    import pandas as pd
    rows = db.query(SampleRecord).all()
    data = [
        {"ID": r.id, "Barcode": r.barcode, "Name": r.name, "Status": r.status,
         "Storage Location": getattr(r, "storage_location", "") or ""}
        for r in rows
    ]
    return _csv_response(pd.DataFrame(data), f"samples_{datetime.now().strftime('%Y%m%d')}.csv")


# ─── Grants ──────────────────────────────────────────────────────────────────

@router.get("/grants.xlsx")
def export_grants_xlsx(db: Session = Depends(get_db), _=Depends(get_current_user)):
    import pandas as pd
    rows = db.query(GrantSubmission).all()
    data = [
        {
            "ID": r.id,
            "Title": r.title,
            "Agency": getattr(r, "agency", ""),
            "Status": r.status,
            "Deadline": str(getattr(r, "deadline", "") or ""),
            "Amount Requested": getattr(r, "amount_requested", "") or "",
            "PI": getattr(r, "pi_name", "") or "",
        }
        for r in rows
    ]
    return _xlsx_response(pd.DataFrame(data), f"grants_{datetime.now().strftime('%Y%m%d')}.xlsx")


# ─── Procurement / Purchase Orders ───────────────────────────────────────────

@router.get("/procurement.xlsx")
def export_procurement_xlsx(db: Session = Depends(get_db), _=Depends(get_current_user)):
    import pandas as pd
    rows = db.query(PurchaseOrder).all()
    data = [
        {
            "ID": r.id,
            "Item": getattr(r, "item_name", ""),
            "Quantity": getattr(r, "quantity", ""),
            "Unit Price": getattr(r, "unit_price", ""),
            "Total": getattr(r, "total", ""),
            "Status": r.status,
            "Supplier": getattr(r, "supplier_name", "") or "",
            "Requester": getattr(r, "requester_name", "") or "",
            "Created": str(getattr(r, "created_at", "") or ""),
        }
        for r in rows
    ]
    return _xlsx_response(pd.DataFrame(data), f"procurement_{datetime.now().strftime('%Y%m%d')}.xlsx")


# ─── Training records ────────────────────────────────────────────────────────

@router.get("/training.xlsx")
def export_training_xlsx(db: Session = Depends(get_db), _=Depends(get_current_user)):
    import pandas as pd
    rows = db.query(TrainingRecord).all()
    data = [
        {
            "ID": r.id,
            "User": getattr(r, "user_name", "") or "",
            "Title": r.title,
            "Status": r.status,
            "Completed On": str(r.completed_on or ""),
            "Expires On": str(r.expires_on or ""),
        }
        for r in rows
    ]
    return _xlsx_response(pd.DataFrame(data), f"training_{datetime.now().strftime('%Y%m%d')}.xlsx")


# ─── CAPA records ────────────────────────────────────────────────────────────

@router.get("/capa.xlsx")
def export_capa_xlsx(db: Session = Depends(get_db), _=Depends(get_current_user)):
    import pandas as pd
    rows = db.query(CapaRecord).all()
    data = [
        {
            "ID": r.id,
            "Title": r.title,
            "Severity": r.severity,
            "Status": r.status,
            "Root Cause": getattr(r, "root_cause", "") or "",
            "Corrective Action": getattr(r, "corrective_action", "") or "",
            "Due Date": str(getattr(r, "due_date", "") or ""),
        }
        for r in rows
    ]
    return _xlsx_response(pd.DataFrame(data), f"capa_{datetime.now().strftime('%Y%m%d')}.xlsx")


# ─── ELN entries → PDF ───────────────────────────────────────────────────────

@router.get("/eln/{entry_id}.pdf")
def export_eln_pdf(entry_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    entry = db.query(LabNotebookEntry).filter(LabNotebookEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "ELN entry not found")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except ImportError:
        raise HTTPException(500, "reportlab not installed")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=16, spaceAfter=12)
    meta_style  = ParagraphStyle("meta",  parent=styles["Normal"],   fontSize=9,  textColor="#666666")
    body_style  = ParagraphStyle("body",  parent=styles["Normal"],   fontSize=11, leading=16)

    title   = getattr(entry, "title", "ELN Entry") or "ELN Entry"
    created = getattr(entry, "created_at", "")
    content = getattr(entry, "content", "") or ""
    # Strip basic HTML tags for plain-text PDF (TipTap outputs HTML)
    import re
    plain_content = re.sub(r"<[^>]+>", " ", content).strip()

    story = [
        Paragraph(title, title_style),
        Paragraph(f"Created: {created}", meta_style),
        Spacer(1, 0.4*cm),
        Paragraph(plain_content or "(no content)", body_style),
    ]
    doc.build(story)
    buf.seek(0)

    safe_title = re.sub(r"[^\w\-]", "_", title)[:40]
    return Response(
        content=buf.read(),
        media_type=PDF_MIME,
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )

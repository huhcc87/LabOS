from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.models.models import Freezer, FreezerBox, FreezerSlot, FreezerType, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/freezer", tags=["freezer"])


class FreezerCreate(BaseModel):
    name: str
    location: str = ""
    temp_setting: str = "-80°C"
    freezer_type: FreezerType = FreezerType.ult
    total_racks: int = 4
    boxes_per_rack: int = 12


class SlotUpsert(BaseModel):
    sample_id: str = ""
    sample_type: str = ""
    date_stored: str = ""
    owner: str = ""
    expiry_date: str = ""
    volume: str = ""
    notes: str = ""


def _freezer_out(f: Freezer, db: Session) -> dict:
    total = f.total_racks * f.boxes_per_rack * 81
    used = (
        db.query(FreezerSlot)
        .join(FreezerBox)
        .filter(FreezerBox.freezer_id == f.id, FreezerSlot.sample_id != "")
        .count()
    )
    return {
        "id": f.id, "name": f.name, "location": f.location,
        "temp_setting": f.temp_setting, "freezer_type": f.freezer_type,
        "total_racks": f.total_racks, "boxes_per_rack": f.boxes_per_rack,
        "is_active": f.is_active, "used_slots": used, "total_slots": total,
    }


def _get_or_create_box(freezer_id: int, rack: int, box: int, db: Session) -> FreezerBox:
    fbox = db.query(FreezerBox).filter(
        FreezerBox.freezer_id == freezer_id,
        FreezerBox.rack_number == rack,
        FreezerBox.box_number == box,
    ).first()
    if not fbox:
        fbox = FreezerBox(freezer_id=freezer_id, rack_number=rack, box_number=box)
        db.add(fbox)
        db.commit()
        db.refresh(fbox)
    return fbox


@router.get("")
def list_freezers(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [_freezer_out(f, db) for f in db.query(Freezer).filter(Freezer.is_active == True).all()]


@router.post("", status_code=201)
def create_freezer(body: FreezerCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = Freezer(**body.model_dump())
    db.add(f)
    db.commit()
    db.refresh(f)
    return _freezer_out(f, db)


@router.delete("/{freezer_id}", status_code=204)
def delete_freezer(freezer_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = db.query(Freezer).filter(Freezer.id == freezer_id).first()
    if not f:
        raise HTTPException(404)
    f.is_active = False
    db.commit()


@router.get("/{freezer_id}/slots")
def get_box_slots(
    freezer_id: int, rack: int = 1, box: int = 1,
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    fbox = _get_or_create_box(freezer_id, rack, box, db)
    slots = db.query(FreezerSlot).filter(FreezerSlot.box_id == fbox.id).all()
    return [
        {
            "id": s.id, "box_id": s.box_id, "row_idx": s.row_idx, "col_idx": s.col_idx,
            "sample_id": s.sample_id, "sample_type": s.sample_type, "date_stored": s.date_stored,
            "owner": s.owner, "expiry_date": s.expiry_date, "volume": s.volume, "notes": s.notes,
        }
        for s in slots
    ]


@router.put("/{freezer_id}/slots/{rack}/{box}/{row}/{col}")
def upsert_slot(
    freezer_id: int, rack: int, box: int, row: int, col: int,
    body: SlotUpsert,
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    fbox = _get_or_create_box(freezer_id, rack, box, db)
    slot = db.query(FreezerSlot).filter(
        FreezerSlot.box_id == fbox.id,
        FreezerSlot.row_idx == row,
        FreezerSlot.col_idx == col,
    ).first()
    if slot:
        for k, v in body.model_dump().items():
            setattr(slot, k, v)
    else:
        slot = FreezerSlot(box_id=fbox.id, row_idx=row, col_idx=col, **body.model_dump())
        db.add(slot)
    db.commit()
    db.refresh(slot)
    return {"id": slot.id, "row_idx": slot.row_idx, "col_idx": slot.col_idx,
            "sample_id": slot.sample_id, "sample_type": slot.sample_type,
            "date_stored": slot.date_stored, "owner": slot.owner,
            "expiry_date": slot.expiry_date, "volume": slot.volume, "notes": slot.notes}


@router.get("/expiring/list")
def get_expiring(days: int = 30, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cutoff = (date.today() + timedelta(days=days)).isoformat()
    today = date.today().isoformat()
    slots = db.query(FreezerSlot).filter(
        FreezerSlot.expiry_date != "",
        FreezerSlot.expiry_date <= cutoff,
        FreezerSlot.sample_id != "",
    ).all()
    result = []
    for s in slots:
        box = db.query(FreezerBox).filter(FreezerBox.id == s.box_id).first()
        freezer = db.query(Freezer).filter(Freezer.id == box.freezer_id).first() if box else None
        status = "expired" if s.expiry_date < today else "expiring_soon"
        result.append({
            "id": s.sample_id, "type": s.sample_type, "date": s.date_stored,
            "owner": s.owner, "expiry": s.expiry_date, "volume": s.volume,
            "status": status,
            "freezer": freezer.name if freezer else "",
            "rack": f"Rack {box.rack_number}" if box else "",
            "box": f"Box {box.box_number}" if box else "",
            "position": f"{chr(65+s.row_idx)}{s.col_idx+1}",
        })
    return result


@router.get("/search/slots")
def search_slots(q: str = "", db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not q:
        return []
    slots = db.query(FreezerSlot).filter(
        (FreezerSlot.sample_id.ilike(f"%{q}%")) |
        (FreezerSlot.sample_type.ilike(f"%{q}%")) |
        (FreezerSlot.owner.ilike(f"%{q}%"))
    ).limit(50).all()
    result = []
    for s in slots:
        box = db.query(FreezerBox).filter(FreezerBox.id == s.box_id).first()
        freezer = db.query(Freezer).filter(Freezer.id == box.freezer_id).first() if box else None
        result.append({
            "sample_id": s.sample_id, "sample_type": s.sample_type, "owner": s.owner,
            "expiry_date": s.expiry_date, "volume": s.volume,
            "freezer": freezer.name if freezer else "",
            "rack": box.rack_number if box else 0,
            "box": box.box_number if box else 0,
            "position": f"{chr(65+s.row_idx)}{s.col_idx+1}",
        })
    return result

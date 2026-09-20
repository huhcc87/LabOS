import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, Reference, User
from app.schemas.schemas import PaginatedResponse, ReferenceCreate, ReferenceOut, ReferenceUpdate
from app.services.auth import get_current_user, write_audit

router = APIRouter(prefix="/references", tags=["references"])


def _to_out(ref: Reference) -> ReferenceOut:
    def parse(s: str) -> list:
        try:
            return json.loads(s) if s else []
        except Exception:
            return [x.strip() for x in s.split(",") if x.strip()]

    return ReferenceOut(
        id=ref.id,
        pmid=ref.pmid,
        doi=ref.doi,
        title=ref.title,
        authors=parse(ref.authors),
        journal=ref.journal,
        year=ref.year,
        volume=ref.volume,
        issue=ref.issue,
        pages=ref.pages,
        abstract=ref.abstract,
        tags=parse(ref.tags),
        folder=ref.folder,
        is_favorite=ref.is_favorite,
        notes=ref.notes,
        citations=ref.citations,
        created_by=ref.created_by,
        created_at=ref.created_at,
        updated_at=ref.updated_at,
    )


@router.get("", response_model=PaginatedResponse[ReferenceOut])
def list_references(
    page: int = 1,
    per_page: int = 50,
    folder: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Reference).order_by(Reference.created_at.desc())
    if folder and folder != "All":
        q = q.filter(Reference.folder == folder)
    if search:
        like = f"%{search}%"
        q = q.filter(
            Reference.title.ilike(like) |
            Reference.authors.ilike(like) |
            Reference.tags.ilike(like) |
            Reference.journal.ilike(like)
        )
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(
        items=[_to_out(r) for r in items],
        total=total, page=page, per_page=per_page, pages=pages,
    )


@router.post("", response_model=ReferenceOut, status_code=201)
def create_reference(
    body: ReferenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = body.model_dump()
    data["authors"] = json.dumps(data["authors"])
    data["tags"] = json.dumps(data["tags"])
    ref = Reference(**data, created_by=current_user.id)
    db.add(ref)
    db.flush()
    write_audit(db, AuditAction.create, "reference", ref.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(ref)
    return _to_out(ref)


@router.patch("/{ref_id}", response_model=ReferenceOut)
def update_reference(
    ref_id: int,
    body: ReferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ref = db.query(Reference).filter(Reference.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")
    data = body.model_dump(exclude_none=True)
    if "authors" in data:
        data["authors"] = json.dumps(data["authors"])
    if "tags" in data:
        data["tags"] = json.dumps(data["tags"])
    for k, v in data.items():
        setattr(ref, k, v)
    write_audit(db, AuditAction.update, "reference", ref_id, current_user, data)
    db.commit()
    db.refresh(ref)
    return _to_out(ref)


@router.delete("/{ref_id}", status_code=204)
def delete_reference(
    ref_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ref = db.query(Reference).filter(Reference.id == ref_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")
    write_audit(db, AuditAction.delete, "reference", ref_id, current_user, {})
    db.delete(ref)
    db.commit()


@router.get("/folders/list")
def list_folders(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.query(Reference.folder).distinct().all()
    folders = sorted({r[0] for r in rows if r[0]})
    return {"folders": folders}

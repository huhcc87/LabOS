import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import BiosketchProfile, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/biosketch", tags=["biosketch"])


class BiosketchUpdate(BaseModel):
    education: list = []
    positions: list = []
    honors: list = []
    contributions: list = []
    products: list = []
    research_support: list = []


def _to_out(p: BiosketchProfile) -> dict:
    return {
        "id": p.id,
        "user_id": p.user_id,
        "education": json.loads(p.education_json or "[]"),
        "positions": json.loads(p.positions_json or "[]"),
        "honors": json.loads(p.honors_json or "[]"),
        "contributions": json.loads(p.contributions_json or "[]"),
        "products": json.loads(p.products_json or "[]"),
        "research_support": json.loads(p.research_support_json or "[]"),
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _get_or_create(user_id: int, db: Session) -> BiosketchProfile:
    p = db.query(BiosketchProfile).filter(BiosketchProfile.user_id == user_id).first()
    if not p:
        p = BiosketchProfile(user_id=user_id)
        db.add(p)
        db.commit()
        db.refresh(p)
    return p


@router.get("/me")
def get_biosketch(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _to_out(_get_or_create(user.id, db))


@router.put("/me")
def save_biosketch(body: BiosketchUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = _get_or_create(user.id, db)
    p.education_json = json.dumps(body.education)
    p.positions_json = json.dumps(body.positions)
    p.honors_json = json.dumps(body.honors)
    p.contributions_json = json.dumps(body.contributions)
    p.products_json = json.dumps(body.products)
    p.research_support_json = json.dumps(body.research_support)
    p.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    return _to_out(p)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, LabUnit, Organization, Site, User, UserRole
from app.schemas.schemas import LabUnitCreate, LabUnitOut, OrgCreate, OrgOut, SiteCreate, SiteOut
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/org", tags=["org-hierarchy"])


# ── Organizations ─────────────────────────────────────────────────────────────

@router.get("/organizations", response_model=list[OrgOut])
def list_orgs(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Organization).order_by(Organization.name).all()


@router.post("/organizations", response_model=OrgOut, status_code=201)
def create_org(
    body: OrgCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    org = Organization(**body.model_dump())
    db.add(org)
    db.flush()
    write_audit(db, AuditAction.create, "organization", org.id, current_user, {"name": body.name})
    db.commit()
    db.refresh(org)
    return org


@router.delete("/organizations/{org_id}", status_code=204)
def delete_org(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    write_audit(db, AuditAction.delete, "organization", org_id, current_user, {})
    db.delete(org)
    db.commit()


# ── Sites ─────────────────────────────────────────────────────────────────────

@router.get("/sites", response_model=list[SiteOut])
def list_sites(
    org_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Site)
    if org_id:
        q = q.filter(Site.organization_id == org_id)
    return q.order_by(Site.name).all()


@router.post("/sites", response_model=SiteOut, status_code=201)
def create_site(
    body: SiteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    site = Site(**body.model_dump())
    db.add(site)
    db.flush()
    write_audit(db, AuditAction.create, "site", site.id, current_user, {"name": body.name})
    db.commit()
    db.refresh(site)
    return site


@router.delete("/sites/{site_id}", status_code=204)
def delete_site(
    site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    write_audit(db, AuditAction.delete, "site", site_id, current_user, {})
    db.delete(site)
    db.commit()


# ── Lab Units ─────────────────────────────────────────────────────────────────

@router.get("/labs", response_model=list[LabUnitOut])
def list_labs(
    site_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(LabUnit)
    if site_id:
        q = q.filter(LabUnit.site_id == site_id)
    return q.order_by(LabUnit.name).all()


@router.post("/labs", response_model=LabUnitOut, status_code=201)
def create_lab(
    body: LabUnitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    lab = LabUnit(**body.model_dump())
    db.add(lab)
    db.flush()
    write_audit(db, AuditAction.create, "lab_unit", lab.id, current_user, {"name": body.name})
    db.commit()
    db.refresh(lab)
    return lab


@router.delete("/labs/{lab_id}", status_code=204)
def delete_lab(
    lab_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    lab = db.query(LabUnit).filter(LabUnit.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab unit not found")
    write_audit(db, AuditAction.delete, "lab_unit", lab_id, current_user, {})
    db.delete(lab)
    db.commit()


# ── Org Tree (read-only) ──────────────────────────────────────────────────────

@router.get("/tree")
def org_tree(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    orgs = db.query(Organization).filter(Organization.is_active == True).all()
    result = []
    for org in orgs:
        org_data = {
            "id": org.id, "name": org.name, "short_code": org.short_code,
            "country": org.country, "city": org.city,
            "sites": [],
        }
        for site in org.sites:
            if not site.is_active:
                continue
            site_data = {
                "id": site.id, "name": site.name, "code": site.code,
                "site_type": site.site_type, "city": site.city, "timezone": site.timezone,
                "labs": [],
            }
            for lab in site.labs:
                if not lab.is_active:
                    continue
                site_data["labs"].append({
                    "id": lab.id, "name": lab.name, "code": lab.code,
                    "lab_type": lab.lab_type, "pi_user_id": lab.pi_user_id,
                    "capacity_persons": lab.capacity_persons,
                })
            org_data["sites"].append(site_data)
        result.append(org_data)
    return {"organizations": result}

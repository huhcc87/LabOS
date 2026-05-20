from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, DocumentTemplate, User, UserRole
from app.schemas.schemas import DocumentTemplateCreate, DocumentTemplateOut, DocumentTemplateUpdate, PaginatedResponse
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/templates", tags=["templates"])


def _enrich(t: DocumentTemplate) -> dict:
    data = {c.name: getattr(t, c.name) for c in t.__table__.columns}
    data["creator_name"] = t.creator.full_name if t.creator else None
    return data


@router.get("", response_model=PaginatedResponse[DocumentTemplateOut])
def list_templates(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    category: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(DocumentTemplate).filter(DocumentTemplate.is_active == True)
    if search:
        q = q.filter(DocumentTemplate.name.ilike(f"%{search}%") | DocumentTemplate.description.ilike(f"%{search}%"))
    if category:
        q = q.filter(DocumentTemplate.category == category)
    total = q.count()
    items = q.order_by(DocumentTemplate.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    enriched = [DocumentTemplateOut.model_validate(_enrich(t)) for t in items]
    return PaginatedResponse(items=enriched, total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=DocumentTemplateOut, status_code=201)
def create_template(
    body: DocumentTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    template = DocumentTemplate(
        name=body.name,
        category=body.category,
        description=body.description,
        content=body.content,
        variables=body.variables,
        created_by=body.created_by or current_user.id,
    )
    db.add(template)
    write_audit(db, AuditAction.create, "template", template.id, current_user, {"name": body.name})
    db.commit()
    db.refresh(template)
    return DocumentTemplateOut.model_validate(_enrich(template))


@router.get("/{template_id}", response_model=DocumentTemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return DocumentTemplateOut.model_validate(_enrich(t))


@router.put("/{template_id}", response_model=DocumentTemplateOut)
def update_template(
    template_id: int,
    body: DocumentTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    changes = {}
    for field_name in ("name", "category", "description", "content", "variables", "is_active"):
        val = getattr(body, field_name)
        if val is not None:
            changes[field_name] = str(val)
            setattr(t, field_name, val)
    write_audit(db, AuditAction.update, "template", template_id, current_user, changes)
    db.commit()
    db.refresh(t)
    return DocumentTemplateOut.model_validate(_enrich(t))


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    write_audit(db, AuditAction.delete, "template", template_id, current_user, {"name": t.name})
    db.delete(t)
    db.commit()


@router.post("/{template_id}/render")
def render_template(
    template_id: int,
    variables: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Render a template with provided variables"""
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    content = t.content
    for key, value in variables.items():
        content = content.replace(f"{{{{{key}}}}}", str(value))

    return {"rendered_content": content}

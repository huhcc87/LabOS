import os
import re
import shutil
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.models import Attachment, User
from app.schemas.schemas import AttachmentOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/files", tags=["files"])

# Security: Allowed file extensions
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.txt', '.csv', '.ppt', '.pptx'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Security: Dangerous patterns to block
DANGEROUS_PATTERNS = [
    r'\.exe$', r'\.bat$', r'\.cmd$', r'\.sh$', r'\.ps1$',
    r'\.js$', r'\.vbs$', r'\.jar$', r'\.php$', r'\.py$',
    r'\.dll$', r'\.so$', r'\.dylib$', r'\.bin$'
]


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and other attacks."""
    # Remove directory components
    filename = Path(filename).name
    # Remove null bytes and other control characters
    filename = re.sub(r'[\x00-\x1f\x7f]', '', filename)
    # Remove potentially dangerous characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext
    return filename or "upload"


def validate_file(file: UploadFile) -> None:
    """Validate uploaded file for security."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    # Check file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Check for dangerous patterns
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, file.filename.lower()):
            raise HTTPException(status_code=400, detail="File type not allowed for security reasons")

    # Check content type (basic validation)
    if file.content_type:
        dangerous_types = ['application/x-executable', 'application/x-msdownload', 'text/x-script']
        if any(dt in file.content_type for dt in dangerous_types):
            raise HTTPException(status_code=400, detail="File content type not allowed")


def get_upload_path(entity_type: str, entity_id: int) -> Path:
    # Security: Validate entity_type to prevent directory traversal
    safe_entity_type = re.sub(r'[^a-zA-Z0-9_-]', '', entity_type)
    if not safe_entity_type:
        raise HTTPException(status_code=400, detail="Invalid entity type")

    base = Path(settings.upload_dir) / safe_entity_type / str(entity_id)
    base.mkdir(parents=True, exist_ok=True)
    return base


@router.post("/upload", response_model=AttachmentOut, status_code=201)
async def upload_file(
    entity_type: str = Query(..., max_length=50),
    entity_id: int = Query(..., gt=0),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Security: Validate file
    validate_file(file)

    # Security: Check file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    upload_path = get_upload_path(entity_type, entity_id)

    # Security: Sanitize filename and add random component
    safe_filename = sanitize_filename(file.filename)
    random_prefix = secrets.token_hex(8)
    stem = Path(safe_filename).stem
    suffix = Path(safe_filename).suffix.lower()
    unique_filename = f"{random_prefix}_{stem}{suffix}"

    dest = upload_path / unique_filename

    # Ensure no collision (shouldn't happen with random prefix but be safe)
    counter = 1
    while dest.exists():
        unique_filename = f"{random_prefix}_{stem}_{counter}{suffix}"
        dest = upload_path / unique_filename
        counter += 1

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    attachment = Attachment(
        entity_type=entity_type,
        entity_id=entity_id,
        filename=dest.name,
        filepath=str(dest),
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return AttachmentOut.model_validate({
        "id": attachment.id,
        "entity_type": attachment.entity_type,
        "entity_id": attachment.entity_id,
        "filename": attachment.filename,
        "filepath": attachment.filepath,
        "uploaded_by": attachment.uploaded_by,
        "uploader_name": current_user.full_name,
        "uploaded_at": attachment.uploaded_at,
    })


@router.get("/{entity_type}/{entity_id}", response_model=list[AttachmentOut])
def list_attachments(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.query(Attachment).filter(
        Attachment.entity_type == entity_type,
        Attachment.entity_id == entity_id,
    ).all()
    return [
        AttachmentOut.model_validate({
            "id": a.id, "entity_type": a.entity_type, "entity_id": a.entity_id,
            "filename": a.filename, "filepath": a.filepath, "uploaded_by": a.uploaded_by,
            "uploader_name": a.uploader.full_name if a.uploader else None,
            "uploaded_at": a.uploaded_at,
        })
        for a in rows
    ]


@router.get("/download/{attachment_id}")
def download_file(
    attachment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    a = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if not os.path.exists(a.filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(a.filepath, filename=a.filename)


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    a = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if os.path.exists(a.filepath):
        os.remove(a.filepath)
    db.delete(a)
    db.commit()

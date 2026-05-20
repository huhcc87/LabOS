import re
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.models import AuditAction, SecurityEventSeverity, SecurityEventType, User, UserRole
from app.schemas.schemas import LoginRequest, PaginatedResponse, Token, UserCreate, UserOut, UserUpdate
from app.services.auth import get_current_user, require_role, write_audit
from app.api.security import create_session, log_security_event

router = APIRouter(prefix="/auth", tags=["auth"])

PASSWORD_RE = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>/?]).{8,}$'
)


def _validate_password(pw: str) -> None:
    if not PASSWORD_RE.match(pw):
        raise HTTPException(
            status_code=422,
            detail=(
                "Password must be at least 8 characters and include uppercase, "
                "lowercase, a digit, and a special character."
            ),
        )


def _check_lockout(user: User) -> None:
    if user.locked_until and datetime.now(timezone.utc) < user.locked_until.replace(tzinfo=timezone.utc):
        unlock_in = int((user.locked_until.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=423,
            detail=f"Account locked due to too many failed attempts. Try again in {unlock_in} minute(s).",
        )


@router.post("/login", response_model=Token)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")

    user = db.query(User).filter(User.email == body.email).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _check_lockout(user)

    if not verify_password(body.password, user.hashed_password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= settings.max_login_attempts:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.lockout_duration_minutes)
            user.failed_login_attempts = 0
            log_security_event(db, SecurityEventType.login_locked,
                               severity=SecurityEventSeverity.critical,
                               user=user, ip_address=ip, user_agent=ua,
                               details={"lockout_minutes": settings.lockout_duration_minutes})
            db.commit()
            raise HTTPException(
                status_code=423,
                detail=f"Too many failed attempts. Account locked for {settings.lockout_duration_minutes} minutes.",
            )
        log_security_event(db, SecurityEventType.login_failed,
                           severity=SecurityEventSeverity.warning,
                           user=user, ip_address=ip, user_agent=ua,
                           details={"attempts": user.failed_login_attempts})
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    # Reset lockout on successful login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)

    token = create_access_token(subject=user.id, role=user.role.value)
    create_session(db, user, token, request)
    log_security_event(db, SecurityEventType.login_success,
                       user=user, ip_address=ip, user_agent=ua)
    db.commit()

    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=PaginatedResponse[UserOut])
def list_users(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    q = db.query(User)
    if search:
        q = q.filter(User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.post("/auth/change-password", status_code=204)
def change_password(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_pw = body.get("current_password", "")
    new_pw = body.get("new_password", "")
    if not verify_password(current_pw, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    _validate_password(new_pw)
    current_user.hashed_password = get_password_hash(new_pw)
    current_user.password_changed_at = datetime.now(timezone.utc)
    current_user.must_change_password = False
    write_audit(db, AuditAction.update, "user", current_user.id, current_user, {"password": "changed"})
    db.commit()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    _validate_password(body.password)
    user = User(
        full_name=body.full_name,
        email=body.email,
        hashed_password=get_password_hash(body.password),
        role=body.role,
        is_active=body.is_active,
    )
    db.add(user)
    db.flush()
    write_audit(db, AuditAction.create, "user", user.id, current_user, {"email": body.email, "role": body.role})
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    changes = {}
    if body.full_name is not None:
        changes["full_name"] = body.full_name
        user.full_name = body.full_name
    if body.email is not None:
        changes["email"] = body.email
        user.email = body.email
    if body.password is not None:
        _validate_password(body.password)
        user.hashed_password = get_password_hash(body.password)
        user.password_changed_at = datetime.now(timezone.utc)
        changes["password"] = "changed"
    if body.role is not None:
        changes["role"] = body.role
        user.role = body.role
    if body.is_active is not None:
        changes["is_active"] = body.is_active
        user.is_active = body.is_active
    write_audit(db, AuditAction.update, "user", user_id, current_user, changes)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    write_audit(db, AuditAction.delete, "user", user_id, current_user, {"email": user.email})
    db.delete(user)
    db.commit()

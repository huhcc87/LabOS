import hashlib
import json
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.models import AuditAction, AuditLog, ROLE_HIERARCHY, User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        subject = payload.get("sub")
        if subject is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc
    user = db.query(User).filter(User.id == int(subject)).first()
    if not user or not user.is_active:
        raise credentials_exception
    return user


def require_role(min_role: UserRole):
    """Dependency: user must have at least min_role in the hierarchy."""
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        user_level = ROLE_HIERARCHY.get(current_user.role, 0)
        required_level = ROLE_HIERARCHY.get(min_role, 0)
        if user_level < required_level:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return dependency


def require_roles(*allowed_roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return dependency


def _compute_chain_hash(prev_hash: str, entry: "AuditLog") -> str:
    """SHA-256 over prev_hash + canonical entry fields."""
    payload = f"{prev_hash}|{entry.action}|{entry.entity_type}|{entry.entity_id}|{entry.user_email}|{entry.changes_json}|{entry.timestamp.isoformat()}"
    return hashlib.sha256(payload.encode()).hexdigest()


def write_audit(
    db: Session,
    action: AuditAction,
    entity_type: str,
    entity_id: int | None,
    user: "User | None",
    changes: dict,
):
    # Get the hash of the last audit entry (chain link)
    last = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    prev_hash = last.chain_hash if (last and last.chain_hash) else "0" * 64

    ts = datetime.now(timezone.utc)
    log = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user.id if user else None,
        user_email=user.email if user else "",
        changes_json=json.dumps(changes),
        timestamp=ts,
        prev_hash=prev_hash,
    )
    # Compute chain hash before adding so all fields are set
    log.chain_hash = _compute_chain_hash(prev_hash, log)
    db.add(log)
    # caller must commit

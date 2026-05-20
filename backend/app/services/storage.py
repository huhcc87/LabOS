"""
Cloud file storage abstraction.

Tries cloud storage first (Cloudflare R2 or AWS S3), falls back to local disk
under UPLOAD_DIR. This way the same code works in:
  - Dev (no R2 env vars → local disk)
  - Production (R2 env vars set → cloud storage, no egress fees)

Env vars needed for R2:
  R2_ACCESS_KEY_ID=...
  R2_SECRET_ACCESS_KEY=...
  R2_BUCKET=labos-uploads
  R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
  R2_PUBLIC_URL=https://pub-XXX.r2.dev   # optional, for direct file access
"""
import logging
import os
import uuid
from pathlib import Path
from typing import Optional, BinaryIO

from app.core.config import settings

logger = logging.getLogger(__name__)


def _r2_configured() -> bool:
    return bool(
        os.environ.get("R2_ACCESS_KEY_ID")
        and os.environ.get("R2_SECRET_ACCESS_KEY")
        and os.environ.get("R2_BUCKET")
        and os.environ.get("R2_ENDPOINT")
    )


def _get_s3_client():
    """Get a boto3 client pointing at R2 (or any S3-compatible store)."""
    try:
        import boto3  # type: ignore
        from botocore.config import Config  # type: ignore
    except ImportError:
        logger.error("boto3 not installed — install with: pip install boto3")
        return None
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def save_file(file_obj: BinaryIO, original_filename: str, content_type: Optional[str] = None,
              subfolder: str = "general") -> dict:
    """Save a file to cloud storage or local disk. Returns metadata dict:
    {
      "key": "general/abc-123.pdf",
      "url": "https://...",
      "size": 12345,
      "storage": "r2" | "local",
    }
    """
    # Generate unique key
    ext = Path(original_filename).suffix or ""
    key = f"{subfolder}/{uuid.uuid4().hex}{ext}"

    # Read file size
    file_obj.seek(0, 2)  # seek to end
    size = file_obj.tell()
    file_obj.seek(0)

    # Try R2 / S3 first
    if _r2_configured():
        try:
            client = _get_s3_client()
            if client:
                bucket = os.environ["R2_BUCKET"]
                client.upload_fileobj(
                    file_obj, bucket, key,
                    ExtraArgs={"ContentType": content_type} if content_type else {},
                )
                public_base = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
                url = f"{public_base}/{key}" if public_base else f"{os.environ['R2_ENDPOINT']}/{bucket}/{key}"
                return {"key": key, "url": url, "size": size, "storage": "r2"}
        except Exception as exc:
            logger.error("R2 upload failed (falling back to local): %s", exc)

    # Local disk fallback
    upload_dir = Path(settings.upload_dir) / subfolder
    upload_dir.mkdir(parents=True, exist_ok=True)
    local_path = upload_dir / Path(key).name
    file_obj.seek(0)
    with open(local_path, "wb") as f:
        f.write(file_obj.read())
    return {
        "key": key,
        "url": f"/uploads/{subfolder}/{local_path.name}",
        "size": size,
        "storage": "local",
    }


def delete_file(key: str) -> bool:
    if _r2_configured():
        try:
            client = _get_s3_client()
            if client:
                client.delete_object(Bucket=os.environ["R2_BUCKET"], Key=key)
                return True
        except Exception as exc:
            logger.error("R2 delete failed: %s", exc)
    # Local fallback
    try:
        local_path = Path(settings.upload_dir) / key
        if local_path.exists():
            local_path.unlink()
            return True
    except Exception as exc:
        logger.error("Local delete failed: %s", exc)
    return False


def get_presigned_url(key: str, expires_in: int = 3600) -> Optional[str]:
    """Generate a temporary signed URL for private file access."""
    if not _r2_configured():
        return f"/uploads/{key}"
    try:
        client = _get_s3_client()
        if client:
            return client.generate_presigned_url(
                "get_object",
                Params={"Bucket": os.environ["R2_BUCKET"], "Key": key},
                ExpiresIn=expires_in,
            )
    except Exception as exc:
        logger.error("Presigned URL generation failed: %s", exc)
    return None


def storage_status() -> dict:
    """Used by the admin diagnostics page to show which provider is active."""
    return {
        "configured": _r2_configured(),
        "provider": "r2" if _r2_configured() else "local",
        "bucket": os.environ.get("R2_BUCKET", ""),
        "endpoint": os.environ.get("R2_ENDPOINT", ""),
    }

"""
Security headers and rate-limiting middleware.
Adds OWASP-recommended HTTP headers and a simple in-memory rate limiter
that requires no extra dependencies.
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


# ─── Security Headers ─────────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        response.headers["Cache-Control"] = (
            "no-store" if request.url.path.startswith("/api/auth") else "no-cache"
        )
        return response


# ─── In-memory rate limiter ───────────────────────────────────────────────────

_rate_buckets: dict[str, deque] = defaultdict(deque)
_rate_lock = Lock()

# Limits per (IP, route-prefix): (max_requests, window_seconds)
RATE_LIMITS: dict[str, tuple[int, int]] = {
    "/api/auth/login":       (10,  60),   # 10 login attempts per minute
    "/api/auth/users":       (30,  60),   # 30 user-list/create calls per minute
    "/api/gdpr":             (5,   60),   # 5 GDPR requests per minute
    "/api/consent":          (20,  60),
    "default":               (120, 60),   # 120 req/min for all other routes
}


def _get_limit(path: str) -> tuple[int, int]:
    for prefix, limit in RATE_LIMITS.items():
        if prefix != "default" and path.startswith(prefix):
            return limit
    return RATE_LIMITS["default"]


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        key = f"{client_ip}:{path}"
        max_req, window = _get_limit(path)
        now = time.monotonic()

        with _rate_lock:
            bucket = _rate_buckets[key]
            # evict expired timestamps
            while bucket and bucket[0] < now - window:
                bucket.popleft()
            if len(bucket) >= max_req:
                retry_after = int(window - (now - bucket[0])) + 1
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests — please slow down."},
                    headers={"Retry-After": str(retry_after)},
                )
            bucket.append(now)

        return await call_next(request)

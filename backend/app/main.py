import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.security_middleware import RateLimitMiddleware, SecurityHeadersMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
import os

from app.api import (
    activity,
    admin_migrations,
    ai,
    audit,
    auth,
    biosketch,
    capa,
    compliance,
    consent,
    costs,
    dashboard,
    email_notifications,
    error_tracking,
    feedback,
    files,
    freezer,
    gdpr,
    grant_submissions,
    grant_versions,
    grants,
    incidents,
    instruments,
    integrations,
    inventory,
    iot,
    lab_members,
    lab_notebook,
    maintenance,
    meetings,
    notifications,
    org_hierarchy,
    payments,
    procurement_extras,
    protocols,
    reagent_cart,
    reagents,
    references,
    samples,
    scheduling,
    security,
    signatures,
    sops,
    suppliers,
    tasks,
    templates,
    training,
    video_call,
    workspaces,
)
from app.api import export as export_router
from app.api import settings as lab_settings
from app.core.config import settings
from app.core.migrations import auto_migrate
from app.core.scheduler import start_scheduler, stop_scheduler

os.makedirs(settings.upload_dir, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    auto_migrate()
    start_scheduler()
    from app.api.iot import maybe_start_mqtt
    maybe_start_mqtt()
    yield
    stop_scheduler()


_is_prod = settings.environment == "production"
app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)

# Security middleware — order matters: outermost runs last on response
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(auth.router, prefix="/api")
app.include_router(protocols.router, prefix="/api")
app.include_router(instruments.router, prefix="/api")
app.include_router(training.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(workspaces.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(samples.router, prefix="/api")
app.include_router(scheduling.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(compliance.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(sops.router, prefix="/api")
app.include_router(maintenance.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(costs.router, prefix="/api")
app.include_router(integrations.router, prefix="/api")
app.include_router(lab_settings.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(meetings.router, prefix="/api")
app.include_router(video_call.router, prefix="/api")
app.include_router(suppliers.router, prefix="/api")
app.include_router(grants.router, prefix="/api")
app.include_router(lab_notebook.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(admin_migrations.router, prefix="/api")
app.include_router(iot.router, prefix="/api")
app.include_router(consent.router, prefix="/api")
app.include_router(gdpr.router, prefix="/api")
app.include_router(security.router, prefix="/api")
app.include_router(signatures.router, prefix="/api")
app.include_router(reagents.router, prefix="/api")
app.include_router(capa.router, prefix="/api")
app.include_router(references.router, prefix="/api")
app.include_router(email_notifications.router, prefix="/api")
app.include_router(org_hierarchy.router, prefix="/api")
app.include_router(freezer.router, prefix="/api")
app.include_router(biosketch.router, prefix="/api")
app.include_router(grant_versions.router, prefix="/api")
app.include_router(grant_submissions.router, prefix="/api")
app.include_router(reagent_cart.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(procurement_extras.router, prefix="/api")
app.include_router(lab_members.router, prefix="/api")
app.include_router(export_router.router, prefix="/api")
app.include_router(error_tracking.router, prefix="/api")


# ─── Global exception handler — catches unhandled server errors ──────────
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback

    from starlette.responses import JSONResponse
    error_tracking.record_error(
        source="server",
        message=str(exc),
        stack=traceback.format_exc(),
        url=str(request.url),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/")
def root():
    return {"message": settings.app_name, "status": "running", "version": "v3"}


@app.get("/api/health")
def health():
    """Health probe used by Fly.io, Cloud Run, Render, etc.
    Returns 200 as long as the FastAPI process is alive."""
    return {"status": "ok", "version": "v3"}

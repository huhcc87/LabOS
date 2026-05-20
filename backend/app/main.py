from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.security_middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.api import (
    activity,
    ai,
    audit,
    auth,
    compliance,
    costs,
    dashboard,
    feedback,
    files,
    grants,
    incidents,
    instruments,
    integrations,
    inventory,
    iot,
    lab_notebook,
    maintenance,
    meetings,
    notifications,
    protocols,
    samples,
    scheduling,
    sops,
    suppliers,
    tasks,
    templates,
    training,
    video_call,
    workspaces,
)
from app.api import settings as lab_settings
from app.api import admin_migrations
from app.api import consent, gdpr, security, signatures
from app.api import reagents
from app.api import capa
from app.api import references
from app.api import email_notifications
from app.api import org_hierarchy
from app.api import freezer, biosketch, grant_versions, grant_submissions
from app.api import reagent_cart, payments, procurement_extras, lab_members
from app.api import export as export_router
from app.core.config import settings
from app.core.database import Base, engine
from app.core.migrations import auto_migrate
from app.core.scheduler import start_scheduler, stop_scheduler

import os

os.makedirs(settings.upload_dir, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    auto_migrate()
    start_scheduler()
    from app.api.iot import maybe_start_mqtt
    maybe_start_mqtt()
    yield
    stop_scheduler()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

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


@app.get("/")
def root():
    return {"message": settings.app_name, "status": "running", "version": "v3"}


@app.get("/api/health")
def health():
    """Health probe used by Fly.io, Cloud Run, Render, etc.
    Returns 200 as long as the FastAPI process is alive."""
    return {"status": "ok", "version": "v3"}

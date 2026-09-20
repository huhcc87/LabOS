"""Tests for /api/org/* — Organization → Site → LabUnit hierarchy."""
import pytest


# ── Organizations ─────────────────────────────────────────────────────────────

def test_list_orgs_unauthenticated(client):
    resp = client.get("/api/org/organizations")
    assert resp.status_code == 401


def test_list_orgs_empty(client, staff_headers):
    resp = client.get("/api/org/organizations", headers=staff_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_org_admin(client, admin_headers):
    resp = client.post(
        "/api/org/organizations",
        json={
            "name": "Test University",
            "short_code": "TU",
            "description": "A test academic institution",
            "country": "US",
            "city": "Boston",
            "contact_email": "admin@testuniv.edu",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test University"
    assert data["short_code"] == "TU"
    assert "id" in data


def test_create_org_staff_forbidden(client, staff_headers):
    resp = client.post(
        "/api/org/organizations",
        json={"name": "Unauthorized Org", "short_code": "UO"},
        headers=staff_headers,
    )
    assert resp.status_code == 403


def test_delete_org(client, admin_headers):
    create = client.post(
        "/api/org/organizations",
        json={"name": "Delete Me Org", "short_code": "DMO"},
        headers=admin_headers,
    )
    assert create.status_code == 201
    org_id = create.json()["id"]
    resp = client.delete(f"/api/org/organizations/{org_id}", headers=admin_headers)
    assert resp.status_code == 204


def test_delete_org_not_found(client, admin_headers):
    resp = client.delete("/api/org/organizations/99999", headers=admin_headers)
    assert resp.status_code == 404


# ── Sites ─────────────────────────────────────────────────────────────────────

@pytest.fixture
def org_id(client, admin_headers):
    resp = client.post(
        "/api/org/organizations",
        json={"name": "Fixture Org", "short_code": "FO"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_list_sites(client, staff_headers):
    resp = client.get("/api/org/sites", headers=staff_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_site(client, admin_headers, org_id):
    resp = client.post(
        "/api/org/sites",
        json={
            "organization_id": org_id,
            "name": "Main Campus Lab",
            "code": "MCL",
            "site_type": "lab",
            "country": "US",
            "city": "Cambridge",
            "timezone": "America/New_York",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Main Campus Lab"
    assert data["organization_id"] == org_id


def test_create_site_staff_forbidden(client, staff_headers, org_id):
    resp = client.post(
        "/api/org/sites",
        json={"organization_id": org_id, "name": "Unauthorized Site", "code": "US"},
        headers=staff_headers,
    )
    assert resp.status_code == 403


def test_delete_site(client, admin_headers, org_id):
    create = client.post(
        "/api/org/sites",
        json={"organization_id": org_id, "name": "Delete Site", "code": "DS"},
        headers=admin_headers,
    )
    assert create.status_code == 201
    site_id = create.json()["id"]
    resp = client.delete(f"/api/org/sites/{site_id}", headers=admin_headers)
    assert resp.status_code == 204


# ── Lab Units ─────────────────────────────────────────────────────────────────

@pytest.fixture
def site_id(client, admin_headers, org_id):
    resp = client.post(
        "/api/org/sites",
        json={"organization_id": org_id, "name": "Fixture Site", "code": "FS"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_list_lab_units(client, staff_headers):
    resp = client.get("/api/org/labs", headers=staff_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_lab_unit(client, admin_headers, site_id):
    resp = client.post(
        "/api/org/labs",
        json={
            "site_id": site_id,
            "name": "Genomics Core",
            "code": "GC",
            "lab_type": "research",
            "capacity_persons": 12,
            "notes": "NGS and bioinformatics",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Genomics Core"
    assert data["site_id"] == site_id


def test_delete_lab_unit(client, admin_headers, site_id):
    create = client.post(
        "/api/org/labs",
        json={"site_id": site_id, "name": "Delete Unit", "code": "DU"},
        headers=admin_headers,
    )
    assert create.status_code == 201
    unit_id = create.json()["id"]
    resp = client.delete(f"/api/org/labs/{unit_id}", headers=admin_headers)
    assert resp.status_code == 204

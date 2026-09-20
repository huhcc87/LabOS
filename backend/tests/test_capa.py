import pytest


@pytest.fixture
def capa_payload():
    return {
        "title": "Test CAPA Record",
        "description": "Corrective action for lab audit finding",
        "severity": "major",
        "root_cause": "Inadequate SOPs for reagent handling",
        "corrective_action": "Rewrite SOPs with detailed steps",
        "preventive_action": "Monthly SOP review meetings",
        "due_date": "2026-12-31",
    }


def test_list_capa_unauthenticated(client):
    resp = client.get("/api/capa")
    assert resp.status_code == 401


def test_list_capa(client, staff_headers):
    resp = client.get("/api/capa", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


def test_create_capa(client, staff_headers, capa_payload):
    resp = client.post("/api/capa", json=capa_payload, headers=staff_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test CAPA Record"
    assert data["status"] == "open"


def test_get_capa(client, staff_headers, capa_payload):
    create = client.post("/api/capa", json={**capa_payload, "title": "Get CAPA Test"}, headers=staff_headers)
    assert create.status_code == 201
    cid = create.json()["id"]

    resp = client.get(f"/api/capa/{cid}", headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Get CAPA Test"


def test_update_capa(client, staff_headers, capa_payload):
    create = client.post("/api/capa", json={**capa_payload, "title": "Update CAPA Test"}, headers=staff_headers)
    assert create.status_code == 201
    cid = create.json()["id"]

    resp = client.patch(f"/api/capa/{cid}", json={"title": "Updated CAPA", "severity": "minor"}, headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated CAPA"
    assert resp.json()["severity"] == "minor"


def test_close_capa_via_patch(client, staff_headers, capa_payload):
    create = client.post("/api/capa", json={**capa_payload, "title": "Close CAPA Test"}, headers=staff_headers)
    assert create.status_code == 201
    cid = create.json()["id"]

    resp = client.patch(f"/api/capa/{cid}", json={"status": "closed", "verification_notes": "Action completed and verified."}, headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "closed"
    assert data["closed_at"] is not None


def test_capa_stats(client, staff_headers, capa_payload):
    client.post("/api/capa", json=capa_payload, headers=staff_headers)
    resp = client.get("/api/capa/stats/summary", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "by_status" in data
    assert "by_severity" in data
    assert "overdue" in data


def test_delete_capa(client, admin_headers, capa_payload):
    create = client.post("/api/capa", json={**capa_payload, "title": "Delete CAPA Test"}, headers=admin_headers)
    assert create.status_code == 201
    cid = create.json()["id"]

    resp = client.delete(f"/api/capa/{cid}", headers=admin_headers)
    assert resp.status_code == 204

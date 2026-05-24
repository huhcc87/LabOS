import pytest


@pytest.fixture
def protocol_payload():
    return {
        "title": "Test Protocol",
        "field": "Molecular Biology",
        "description": "A protocol for testing",
        "version": "1.0",
        "steps": [
            {"step_order": 1, "title": "Prepare samples", "instructions": "Collect and label all samples."},
            {"step_order": 2, "title": "Add reagent", "instructions": "Add 200 µL buffer."},
        ],
    }


def test_list_protocols_unauthenticated(client):
    resp = client.get("/api/protocols")
    assert resp.status_code == 401


def test_list_protocols(client, staff_headers):
    resp = client.get("/api/protocols", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


def test_create_protocol(client, admin_headers, protocol_payload):
    resp = client.post("/api/protocols", json=protocol_payload, headers=admin_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test Protocol"
    assert data["field"] == "Molecular Biology"


def test_get_protocol(client, admin_headers, protocol_payload):
    create = client.post("/api/protocols", json={**protocol_payload, "title": "Get Protocol Test"}, headers=admin_headers)
    assert create.status_code == 201
    pid = create.json()["id"]

    resp = client.get(f"/api/protocols/{pid}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Get Protocol Test"


def test_update_protocol(client, admin_headers, protocol_payload):
    create = client.post("/api/protocols", json={**protocol_payload, "title": "Update Protocol Test"}, headers=admin_headers)
    assert create.status_code == 201
    pid = create.json()["id"]

    resp = client.put(f"/api/protocols/{pid}", json={"title": "Updated Title", "description": "Updated"}, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


def test_delete_protocol(client, admin_headers, protocol_payload):
    create = client.post("/api/protocols", json={**protocol_payload, "title": "Delete Protocol Test"}, headers=admin_headers)
    assert create.status_code == 201
    pid = create.json()["id"]

    resp = client.delete(f"/api/protocols/{pid}", headers=admin_headers)
    assert resp.status_code == 204

    resp = client.get(f"/api/protocols/{pid}", headers=admin_headers)
    assert resp.status_code == 404


def test_create_protocol_staff_allowed(client, staff_headers, protocol_payload):
    resp = client.post("/api/protocols", json={**protocol_payload, "title": "Staff Protocol"}, headers=staff_headers)
    assert resp.status_code == 201
    assert resp.json()["title"] == "Staff Protocol"


def test_protocol_search(client, admin_headers, protocol_payload):
    client.post("/api/protocols", json={**protocol_payload, "title": "CRISPR Protocol UniqueXYZ"}, headers=admin_headers)
    resp = client.get("/api/protocols?search=CRISPR", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert any("CRISPR" in p["title"] for p in data["items"])


def test_protocol_pagination(client, admin_headers):
    resp = client.get("/api/protocols?page=1&per_page=3", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["per_page"] == 3

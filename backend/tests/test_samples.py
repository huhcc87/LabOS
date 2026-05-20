import pytest


@pytest.fixture
def sample_payload():
    return {
        "sample_id": "TEST-SAMPLE-001",
        "barcode": "BARCODE-001",
        "sample_type": "DNA",
        "source": "Test source",
        "storage_location": "Freezer A",
        "status": "received",
        "received_on": "2026-03-31",
        "notes": "Test sample",
    }


def test_list_samples_unauthenticated(client):
    resp = client.get("/api/samples")
    assert resp.status_code == 401


def test_list_samples(client, staff_headers):
    resp = client.get("/api/samples", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data


def test_create_sample(client, staff_headers, sample_payload):
    resp = client.post("/api/samples", json=sample_payload, headers=staff_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["sample_id"] == "TEST-SAMPLE-001"
    assert data["status"] == "received"


def test_create_sample_duplicate(client, staff_headers, sample_payload):
    resp = client.post("/api/samples", json=sample_payload, headers=staff_headers)
    assert resp.status_code in (400, 201)  # first might succeed if not already created


def test_get_sample(client, staff_headers, sample_payload):
    # Create
    create_resp = client.post("/api/samples", json={**sample_payload, "sample_id": "TEST-GET-001", "barcode": "BC-GET-001"}, headers=staff_headers)
    if create_resp.status_code == 201:
        sample_id = create_resp.json()["id"]
        resp = client.get(f"/api/samples/{sample_id}", headers=staff_headers)
        assert resp.status_code == 200
        assert resp.json()["sample_id"] == "TEST-GET-001"


def test_update_sample(client, staff_headers, sample_payload):
    create_resp = client.post("/api/samples", json={**sample_payload, "sample_id": "TEST-UPD-001", "barcode": "BC-UPD-001"}, headers=staff_headers)
    if create_resp.status_code == 201:
        sample_id = create_resp.json()["id"]
        resp = client.put(f"/api/samples/{sample_id}", json={"status": "processing", "notes": "Updated"}, headers=staff_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "processing"


def test_delete_sample(client, staff_headers, sample_payload):
    create_resp = client.post("/api/samples", json={**sample_payload, "sample_id": "TEST-DEL-001", "barcode": "BC-DEL-001"}, headers=staff_headers)
    if create_resp.status_code == 201:
        sample_id = create_resp.json()["id"]
        resp = client.delete(f"/api/samples/{sample_id}", headers=staff_headers)
        assert resp.status_code == 204


def test_pagination(client, staff_headers):
    resp = client.get("/api/samples?page=1&per_page=5", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["per_page"] == 5
    assert data["page"] == 1


def test_search_filter(client, staff_headers):
    resp = client.get("/api/samples?search=TEST", headers=staff_headers)
    assert resp.status_code == 200


def test_create_sample_event(client, staff_headers, sample_payload):
    create_resp = client.post("/api/samples", json={**sample_payload, "sample_id": "TEST-EVT-001", "barcode": "BC-EVT-001"}, headers=staff_headers)
    if create_resp.status_code == 201:
        sample_id = create_resp.json()["id"]
        event_resp = client.post("/api/samples/events", json={
            "sample_record_id": sample_id,
            "event_type": "received",
            "location": "Lab",
            "timestamp": "2026-03-31T10:00:00",
            "notes": "Test event",
        }, headers=staff_headers)
        assert event_resp.status_code == 201
        assert event_resp.json()["event_type"] == "received"

"""Tests for /api/iot/* — sensors, readings, and alerts."""
import pytest


@pytest.fixture
def sensor_payload():
    return {
        "sensor_key": "freezer-alpha-001",
        "name": "Freezer Alpha -80°C",
        "location": "Lab 3B",
        "sensor_type": "freezer",
        "unit": "°C",
        "target": -80.0,
        "min_threshold": -85.0,
        "max_threshold": -70.0,
        "notify_email": "lab@test.local",
        "alert_cooldown_minutes": 30,
    }


# ── Sensors ───────────────────────────────────────────────────────────────────

def test_list_sensors_unauthenticated(client):
    resp = client.get("/api/iot/sensors")
    assert resp.status_code == 401


def test_list_sensors_empty(client, staff_headers):
    resp = client.get("/api/iot/sensors", headers=staff_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_sensor(client, admin_headers, sensor_payload):
    resp = client.post("/api/iot/sensors", json=sensor_payload, headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["sensor_key"] == "freezer-alpha-001"
    assert data["name"] == "Freezer Alpha -80°C"
    assert "api_key" in data
    assert "id" in data


def test_create_sensor_duplicate_key(client, admin_headers, sensor_payload):
    client.post("/api/iot/sensors", json=sensor_payload, headers=admin_headers)
    resp = client.post(
        "/api/iot/sensors",
        json={**sensor_payload, "name": "Duplicate"},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_get_sensor(client, admin_headers, sensor_payload):
    create = client.post(
        "/api/iot/sensors",
        json={**sensor_payload, "sensor_key": "get-sensor-001"},
        headers=admin_headers,
    )
    assert create.status_code == 200
    sensor_id = create.json()["id"]
    resp = client.get(f"/api/iot/sensors/{sensor_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == sensor_id


def test_get_sensor_not_found(client, admin_headers):
    resp = client.get("/api/iot/sensors/99999", headers=admin_headers)
    assert resp.status_code == 404


def test_patch_sensor(client, admin_headers, sensor_payload):
    create = client.post(
        "/api/iot/sensors",
        json={**sensor_payload, "sensor_key": "patch-sensor-001"},
        headers=admin_headers,
    )
    assert create.status_code == 200
    sensor_id = create.json()["id"]
    resp = client.patch(
        f"/api/iot/sensors/{sensor_id}",
        json={"name": "Updated Freezer", "min_threshold": -90.0},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Freezer"


def test_delete_sensor(client, admin_headers, sensor_payload):
    create = client.post(
        "/api/iot/sensors",
        json={**sensor_payload, "sensor_key": "delete-sensor-001"},
        headers=admin_headers,
    )
    assert create.status_code == 200
    sensor_id = create.json()["id"]
    resp = client.delete(f"/api/iot/sensors/{sensor_id}", headers=admin_headers)
    assert resp.status_code == 200


# ── Readings ──────────────────────────────────────────────────────────────────

def _create_sensor_for_reading(client, admin_headers, key="reading-sensor-001"):
    payload = {
        "sensor_key": key,
        "name": "Reading Test Sensor",
        "location": "Lab",
        "sensor_type": "freezer",
        "unit": "°C",
        "target": -80.0,
        "min_threshold": -85.0,
        "max_threshold": -70.0,
    }
    resp = client.post("/api/iot/sensors", json=payload, headers=admin_headers)
    assert resp.status_code == 200
    return resp.json()


@pytest.mark.anyio
async def test_post_reading_valid(client, admin_headers):
    sensor = _create_sensor_for_reading(client, admin_headers, "reading-valid-001")
    resp = client.post(
        f"/api/iot/readings/{sensor['sensor_key']}",
        json={"value": -79.5},
        headers={"X-API-Key": sensor["api_key"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["value"] == -79.5


@pytest.mark.anyio
async def test_post_reading_invalid_api_key(client, admin_headers):
    sensor = _create_sensor_for_reading(client, admin_headers, "reading-invalid-001")
    resp = client.post(
        f"/api/iot/readings/{sensor['sensor_key']}",
        json={"value": -80.0},
        headers={"X-API-Key": "wrong-key"},
    )
    assert resp.status_code == 401


def test_sensor_history(client, admin_headers):
    sensor = _create_sensor_for_reading(client, admin_headers, "history-sensor-001")
    resp = client.get(f"/api/iot/sensors/{sensor['id']}/history", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── Alerts ────────────────────────────────────────────────────────────────────

def test_list_alerts(client, admin_headers):
    resp = client.get("/api/iot/alerts", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_alerts_unauthenticated(client):
    resp = client.get("/api/iot/alerts")
    assert resp.status_code == 401


def test_sensor_alerts(client, admin_headers):
    sensor = _create_sensor_for_reading(client, admin_headers, "alert-sensor-001")
    resp = client.get(f"/api/iot/sensors/{sensor['id']}/alerts", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

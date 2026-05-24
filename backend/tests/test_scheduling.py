"""Tests for /api/scheduling/* — calendar events and reminders."""
import pytest


@pytest.fixture
def event_payload():
    return {
        "title": "Team Lab Meeting",
        "event_type": "meeting",
        "start_time": "2026-06-01T10:00:00",
        "end_time": "2026-06-01T11:00:00",
        "location": "Conference Room A",
        "description": "Weekly sync",
        "recurrence_rule": "none",
    }


# ── Calendar ──────────────────────────────────────────────────────────────────

def test_list_calendar_unauthenticated(client):
    resp = client.get("/api/scheduling/calendar")
    assert resp.status_code == 401


def test_list_calendar(client, staff_headers):
    resp = client.get("/api/scheduling/calendar", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


def test_create_event(client, admin_headers, event_payload):
    resp = client.post("/api/scheduling/calendar", json=event_payload, headers=admin_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Team Lab Meeting"
    assert data["event_type"] == "meeting"
    assert "id" in data


def test_create_event_staff(client, staff_headers, event_payload):
    resp = client.post(
        "/api/scheduling/calendar",
        json={**event_payload, "title": "Staff Event"},
        headers=staff_headers,
    )
    assert resp.status_code == 201


def test_get_event(client, admin_headers, event_payload):
    create = client.post("/api/scheduling/calendar", json={**event_payload, "title": "Get Test Event"}, headers=admin_headers)
    assert create.status_code == 201
    event_id = create.json()["id"]
    resp = client.get(f"/api/scheduling/calendar/{event_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == event_id


def test_get_event_not_found(client, admin_headers):
    resp = client.get("/api/scheduling/calendar/99999", headers=admin_headers)
    assert resp.status_code == 404


def test_update_event(client, admin_headers, event_payload):
    create = client.post("/api/scheduling/calendar", json={**event_payload, "title": "Update Me"}, headers=admin_headers)
    assert create.status_code == 201
    event_id = create.json()["id"]
    resp = client.put(f"/api/scheduling/calendar/{event_id}", json={"title": "Updated Title", "location": "Room B"}, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


def test_delete_event(client, admin_headers, event_payload):
    create = client.post("/api/scheduling/calendar", json={**event_payload, "title": "Delete Me"}, headers=admin_headers)
    assert create.status_code == 201
    event_id = create.json()["id"]
    resp = client.delete(f"/api/scheduling/calendar/{event_id}", headers=admin_headers)
    assert resp.status_code == 204
    get = client.get(f"/api/scheduling/calendar/{event_id}", headers=admin_headers)
    assert get.status_code == 404


# ── Reminders ─────────────────────────────────────────────────────────────────

@pytest.fixture
def reminder_payload():
    return {
        "entity_type": "inventory",
        "entity_id": 1,
        "title": "Check freezer temperature",
        "due_at": "2026-06-01T09:00:00",
        "channel": "dashboard",
        "message": "Verify -80°C freezer is within spec",
    }


def test_list_reminders(client, admin_headers):
    resp = client.get("/api/scheduling/reminders", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data


def test_create_reminder(client, admin_headers, reminder_payload):
    resp = client.post("/api/scheduling/reminders", json=reminder_payload, headers=admin_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Check freezer temperature"
    assert "id" in data


def test_reminder_stats(client, admin_headers):
    resp = client.get("/api/scheduling/reminders/stats", headers=admin_headers)
    assert resp.status_code == 200


def test_delete_reminder(client, admin_headers, reminder_payload):
    create = client.post("/api/scheduling/reminders", json={**reminder_payload, "title": "Delete Reminder"}, headers=admin_headers)
    assert create.status_code == 201
    rem_id = create.json()["id"]
    resp = client.delete(f"/api/scheduling/reminders/{rem_id}", headers=admin_headers)
    assert resp.status_code == 204


# ── Bookings ──────────────────────────────────────────────────────────────────

def test_booking_conflicts_endpoint(client, admin_headers):
    resp = client.get("/api/scheduling/bookings/conflicts", headers=admin_headers)
    assert resp.status_code == 200


def test_booking_utilization_endpoint(client, admin_headers):
    resp = client.get("/api/scheduling/bookings/utilization", headers=admin_headers)
    assert resp.status_code == 200

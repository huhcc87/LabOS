"""Tests for /api/ai/* — runs fully against the local (no API key) fallback."""
import pytest


def test_chat_unauthenticated(client):
    resp = client.post("/api/ai/chat", json={"question": "help"})
    assert resp.status_code == 401


def test_chat_local_help(client, staff_headers):
    resp = client.post("/api/ai/chat", json={"question": "what can you do"}, headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert "source" in data
    assert data["source"] in ("claude", "openai", "local")
    assert len(data["answer"]) > 10


def test_chat_inventory_question(client, staff_headers):
    resp = client.post("/api/ai/chat", json={"question": "any low stock items?"}, headers=staff_headers)
    assert resp.status_code == 200
    assert "answer" in resp.json()


def test_chat_tasks_question(client, staff_headers):
    resp = client.post("/api/ai/chat", json={"question": "show overdue tasks"}, headers=staff_headers)
    assert resp.status_code == 200


def test_chat_samples_question(client, staff_headers):
    resp = client.post("/api/ai/chat", json={"question": "how many samples do we have?"}, headers=staff_headers)
    assert resp.status_code == 200


def test_chat_capa_question(client, staff_headers):
    resp = client.post("/api/ai/chat", json={"question": "open CAPA records"}, headers=staff_headers)
    assert resp.status_code == 200


def test_chat_suggestions_returned(client, staff_headers):
    resp = client.post("/api/ai/chat", json={"question": "low stock"}, headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)


def test_inventory_predictions_unauthenticated(client):
    resp = client.get("/api/ai/inventory/predictions")
    assert resp.status_code == 401


def test_inventory_predictions(client, staff_headers):
    resp = client.get("/api/ai/inventory/predictions", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "predictions" in data
    assert "total" in data
    assert isinstance(data["predictions"], list)


def test_anomaly_detection_unauthenticated(client):
    resp = client.get("/api/ai/anomaly-detection")
    assert resp.status_code == 401


def test_anomaly_detection(client, staff_headers):
    resp = client.get("/api/ai/anomaly-detection", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "anomalies" in data
    assert "total" in data
    assert "critical" in data
    assert "warnings" in data
    assert isinstance(data["anomalies"], list)


def test_lab_search_unauthenticated(client):
    resp = client.post("/api/ai/search", json={"query": "test"})
    assert resp.status_code == 401


def test_lab_search_returns_results_shape(client, staff_headers):
    resp = client.post("/api/ai/search", json={"query": "sample"}, headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert "total" in data
    assert "query" in data
    assert data["query"] == "sample"


def test_lab_search_entity_filter(client, staff_headers):
    resp = client.post(
        "/api/ai/search",
        json={"query": "protocol", "entity_types": ["protocols"]},
        headers=staff_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    for r in data["results"]:
        assert r["type"] == "protocol"


def test_protocol_analysis_not_found(client, staff_headers):
    resp = client.get("/api/ai/protocol-analysis/99999", headers=staff_headers)
    assert resp.status_code == 404

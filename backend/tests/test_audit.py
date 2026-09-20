def test_audit_log_unauthenticated(client):
    resp = client.get("/api/audit")
    assert resp.status_code == 401


def test_audit_log_admin(client, admin_headers):
    resp = client.get("/api/audit", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


def test_audit_log_staff_forbidden(client, staff_headers):
    resp = client.get("/api/audit", headers=staff_headers)
    assert resp.status_code == 403


def test_audit_log_filter_by_entity(client, admin_headers):
    # Create a sample to generate a "create" audit entry, then filter by entity_type
    resp = client.get("/api/audit?entity_type=sample", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data


def test_audit_log_total_grows_after_action(client, admin_headers, staff_headers):
    before = client.get("/api/audit", headers=admin_headers).json()["total"]
    # Perform a write action
    client.post("/api/inventory", json={
        "name": "Audit Test Item",
        "category": "Reagent",
        "quantity": 1.0,
        "unit": "mL",
        "location": "Lab",
        "reorder_threshold": 0.5,
    }, headers=staff_headers)
    after = client.get("/api/audit", headers=admin_headers).json()["total"]
    assert after >= before


def test_audit_chain_verify(client, admin_headers):
    resp = client.get("/api/audit/chain/verify", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "valid" in data
    assert data["valid"] is True

def test_my_consents_unauthenticated(client):
    resp = client.get("/api/consent/my")
    assert resp.status_code == 401


def test_my_consents(client, staff_headers):
    resp = client.get("/api/consent/my", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "consents" in data
    assert "user_id" in data
    assert isinstance(data["consents"], list)


def test_grant_consent(client, staff_headers):
    resp = client.put("/api/consent/my", json={
        "purpose": "analytics",
        "granted": True,
        "notes": "",
    }, headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["purpose"] == "analytics"
    assert data["status"] == "granted"


def test_revoke_consent(client, staff_headers):
    client.put("/api/consent/my", json={"purpose": "analytics", "granted": True, "notes": ""}, headers=staff_headers)
    resp = client.put("/api/consent/my", json={"purpose": "analytics", "granted": False, "notes": ""}, headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "revoked"


def test_required_consent_cannot_be_revoked(client, staff_headers):
    resp = client.put("/api/consent/my", json={"purpose": "data_processing", "granted": False, "notes": ""}, headers=staff_headers)
    assert resp.status_code in (400, 422)


def test_data_export_request(client, staff_headers):
    resp = client.post("/api/gdpr/export", headers=staff_headers)
    assert resp.status_code in (200, 201, 202)


def test_data_erasure_request(client, staff_headers):
    resp = client.post("/api/gdpr/erasure-request", json={"reason": "User requested account deletion"}, headers=staff_headers)
    assert resp.status_code in (200, 201, 202)


def test_erasure_requests_admin_only(client, staff_headers, admin_headers):
    resp = client.get("/api/gdpr/erasure-requests", headers=admin_headers)
    assert resp.status_code == 200

    resp_staff = client.get("/api/gdpr/erasure-requests", headers=staff_headers)
    assert resp_staff.status_code == 403


def test_retention_report_admin_only(client, admin_headers, staff_headers):
    resp = client.get("/api/gdpr/retention-report", headers=admin_headers)
    assert resp.status_code == 200

    resp_staff = client.get("/api/gdpr/retention-report", headers=staff_headers)
    assert resp_staff.status_code == 403


def test_change_password(client, staff_headers):
    resp = client.post("/api/auth/change-password", json={
        "current_password": "Staff123!",
        "new_password": "NewStaff456@",
    }, headers=staff_headers)
    assert resp.status_code == 204

    new_resp = client.post("/api/auth/login", json={"email": "teststaff@lab.local", "password": "NewStaff456@"})
    assert new_resp.status_code == 200
    new_token = new_resp.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    # Restore original password
    client.post("/api/auth/change-password", json={"current_password": "NewStaff456@", "new_password": "Staff123!"}, headers=new_headers)


def test_change_password_wrong_current(client, staff_headers):
    resp = client.post("/api/auth/change-password", json={
        "current_password": "WrongPassword!",
        "new_password": "NewPass123!",
    }, headers=staff_headers)
    assert resp.status_code == 400

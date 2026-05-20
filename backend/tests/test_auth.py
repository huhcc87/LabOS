def test_login_success(client):
    resp = client.post("/api/auth/login", json={"email": "testadmin@lab.local", "password": "Admin123!"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "testadmin@lab.local"
    assert data["user"]["role"] == "admin"


def test_login_wrong_password(client):
    resp = client.post("/api/auth/login", json={"email": "testadmin@lab.local", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_user(client):
    resp = client.post("/api/auth/login", json={"email": "nobody@lab.local", "password": "whatever"})
    assert resp.status_code == 401


def test_me(client, admin_headers):
    resp = client.get("/api/auth/me", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "testadmin@lab.local"


def test_me_no_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_list_users_admin(client, admin_headers):
    resp = client.get("/api/auth/users", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


def test_list_users_staff_forbidden(client, staff_headers):
    resp = client.get("/api/auth/users", headers=staff_headers)
    assert resp.status_code == 403


def test_create_user_admin(client, admin_headers):
    resp = client.post(
        "/api/auth/users",
        json={"full_name": "New User", "email": "newuser@lab.local", "password": "NewUser123!", "role": "staff"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["email"] == "newuser@lab.local"


def test_create_user_duplicate_email(client, admin_headers):
    resp = client.post(
        "/api/auth/users",
        json={"full_name": "Dup", "email": "testadmin@lab.local", "password": "X123!", "role": "staff"},
        headers=admin_headers,
    )
    assert resp.status_code == 400

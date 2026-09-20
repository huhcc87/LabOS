import pytest


@pytest.fixture
def item_payload():
    return {
        "name": "Ethanol 70%",
        "category": "Reagent",
        "quantity": 5.0,
        "unit": "L",
        "location": "Chemical Storage A",
        "reorder_threshold": 2.0,
        "notes": "Flammable — store away from heat sources.",
    }


def test_list_inventory_unauthenticated(client):
    resp = client.get("/api/inventory")
    assert resp.status_code == 401


def test_list_inventory(client, staff_headers):
    resp = client.get("/api/inventory", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data


def test_create_inventory_item(client, staff_headers, item_payload):
    resp = client.post("/api/inventory", json=item_payload, headers=staff_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Ethanol 70%"
    assert data["quantity"] == 5.0


def test_get_inventory_item(client, staff_headers, item_payload):
    create = client.post("/api/inventory", json={**item_payload, "name": "PBS Buffer Unique"}, headers=staff_headers)
    assert create.status_code == 201
    iid = create.json()["id"]

    resp = client.get(f"/api/inventory/{iid}", headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "PBS Buffer Unique"


def test_update_inventory_item(client, staff_headers, item_payload):
    create = client.post("/api/inventory", json={**item_payload, "name": "Tris Buffer Unique"}, headers=staff_headers)
    assert create.status_code == 201
    iid = create.json()["id"]

    resp = client.put(f"/api/inventory/{iid}", json={"quantity": 10.0, "location": "New Storage"}, headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["quantity"] == 10.0


def test_delete_inventory_item_requires_manager(client, staff_headers, admin_headers, item_payload):
    create = client.post("/api/inventory", json={**item_payload, "name": "EDTA Solution Unique"}, headers=staff_headers)
    assert create.status_code == 201
    iid = create.json()["id"]

    # Staff cannot delete
    resp_staff = client.delete(f"/api/inventory/{iid}", headers=staff_headers)
    assert resp_staff.status_code == 403

    # Manager/admin can delete
    resp_admin = client.delete(f"/api/inventory/{iid}", headers=admin_headers)
    assert resp_admin.status_code == 204


def test_inventory_search(client, staff_headers, item_payload):
    client.post("/api/inventory", json={**item_payload, "name": "Unique Reagent XYZ789"}, headers=staff_headers)
    resp = client.get("/api/inventory?search=XYZ789", headers=staff_headers)
    assert resp.status_code == 200
    assert any("XYZ789" in i["name"] for i in resp.json()["items"])


def test_inventory_pagination(client, staff_headers):
    resp = client.get("/api/inventory?page=1&per_page=3", headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["per_page"] == 3

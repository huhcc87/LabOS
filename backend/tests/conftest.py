import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.models import User, UserRole

TEST_DATABASE_URL = "sqlite:///./test_lab.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    admin = User(
        full_name="Test Admin",
        email="testadmin@lab.local",
        hashed_password=get_password_hash("Admin123!"),
        role=UserRole.admin,
        is_active=True,
    )
    staff = User(
        full_name="Test Staff",
        email="teststaff@lab.local",
        hashed_password=get_password_hash("Staff123!"),
        role=UserRole.staff,
        is_active=True,
    )
    db.add_all([admin, staff])
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_token(client):
    resp = client.post("/api/auth/login", json={"email": "testadmin@lab.local", "password": "Admin123!"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
def staff_token(client):
    resp = client.post("/api/auth/login", json={"email": "teststaff@lab.local", "password": "Staff123!"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def staff_headers(staff_token):
    return {"Authorization": f"Bearer {staff_token}"}

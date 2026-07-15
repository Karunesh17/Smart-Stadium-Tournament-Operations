import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from services.gateway.database import Base, get_db
from services.gateway.main import app
from services.auth.models import User
from services.crowd.models import Area, CrowdData

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_stadium.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def setup_database():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()

client = TestClient(app, base_url="https://testserver")

def get_auth_header(email: str, name: str, role: str) -> dict:
    client.post("/api/v1/auth/register", json={
        "name": name,
        "email": email,
        "password": "securepassword123",
        "role": role
    })
    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "securepassword123"
    })
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_crowd_tracking_flow():
    security_headers = get_auth_header("officer@stadium.com", "Officer Jones", "security")
    fan_headers = get_auth_header("fan@stadium.com", "Fan Bob", "fan")

    # 1. Register areas under Security role
    res_area = client.post("/api/v1/crowd/areas", json={
        "name": "Gate A Entry",
        "capacity": 1000
    }, headers=security_headers)
    assert res_area.status_code == 201
    area_id = res_area.json()["id"]

    # 2. Block registration from Fan role (403 FORBIDDEN)
    res_fail = client.post("/api/v1/crowd/areas", json={
        "name": "North Stand",
        "capacity": 12000
    }, headers=fan_headers)
    assert res_fail.status_code == 403

    # 3. Post Telemetry Counts
    # Safe level: 500 / 1000 = 50%
    client.post("/api/v1/crowd/telemetry", json={"area_id": area_id, "count": 500})
    res_heatmap = client.get("/api/v1/crowd/heatmap")
    assert res_heatmap.status_code == 200
    assert res_heatmap.json()["areas"][0]["status"] == "safe"
    assert res_heatmap.json()["areas"][0]["density_percentage"] == 50.0

    # Warning level: 750 / 1000 = 75%
    client.post("/api/v1/crowd/telemetry", json={"area_id": area_id, "count": 750})
    res_heatmap = client.get("/api/v1/crowd/heatmap")
    assert res_heatmap.json()["areas"][0]["status"] == "warning"

    # Danger level: 950 / 1000 = 95%
    client.post("/api/v1/crowd/telemetry", json={"area_id": area_id, "count": 950})
    res_heatmap = client.get("/api/v1/crowd/heatmap")
    assert res_heatmap.json()["areas"][0]["status"] == "danger"

def test_privacy_audit():
    # Programmatic privacy verification:
    # Inspected attributes of CrowdData and Area database columns should never reference device or user identity
    from sqlalchemy.inspection import inspect
    
    crowd_data_columns = [col.name for col in inspect(CrowdData).c]
    forbidden_terms = ["mac", "ip", "device", "user_id", "email", "phone", "imei", "uuid", "identifier", "person"]
    
    for col in crowd_data_columns:
        for term in forbidden_terms:
            assert term not in col.lower(), f"Privacy Audit Violation! Forbidden column '{col}' detected in crowd_data table."

    area_columns = [col.name for col in inspect(Area).c]
    for col in area_columns:
        for term in forbidden_terms:
            assert term not in col.lower(), f"Privacy Audit Violation! Forbidden column '{col}' detected in area table."
            
    print("Privacy Audit passed programmatically.")

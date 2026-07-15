import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from services.gateway.database import Base, get_db
from services.gateway.main import app
from services.auth.models import User
from services.crowd.models import Area, CrowdData
from services.staff.models import Staff, Task
from services.risk.models import Incident

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

def test_risk_severity_calculations_and_auto_escalation():
    admin_headers = get_auth_header("admin@stadium.com", "Admin Boss", "admin")
    security_headers = get_auth_header("officer@stadium.com", "Officer Jones", "security")

    # 1. Setup physical sector area
    res_area = client.post("/api/v1/crowd/areas", json={
        "name": "North Stand Sector 1",
        "capacity": 1000
    }, headers=admin_headers)
    area_id = res_area.json()["id"]

    # 2. Setup a specialist Staff profile to test auto-assignment
    # First register user, then profile
    client.post("/api/v1/auth/register", json={
        "name": "Dr. House",
        "email": "house@stadium.com",
        "password": "securepassword123",
        "role": "staff"
    })
    login_staff = client.post("/api/v1/auth/login", json={
        "email": "house@stadium.com",
        "password": "securepassword123"
    })
    token = login_staff.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {token}"}
    res_me = client.get("/api/v1/auth/me", headers=staff_headers)
    staff_user_id = res_me.json()["id"]

    res_staff = client.post("/api/v1/staff/profile", json={
        "user_id": staff_user_id,
        "role_specialty": "Medical"
    }, headers=admin_headers)
    staff_id = res_staff.json()["id"]

    # 3. Ingest low density telemetry (0 count)
    client.post("/api/v1/crowd/telemetry", json={"area_id": area_id, "count": 0})

    # Test Case A: Low Severity (Medical incident, 0 density, Day hour)
    # Score formula: 2.5 (medical multiplier) * 1.0 (density multiplier) * 1.0 (time multiplier) = 2.5
    # Expect level: "medium"
    res_inc_low = client.post("/api/v1/incidents/", json={
        "title": "Faint fan",
        "description": "A fan feels dizzy in stand A",
        "type": "medical",
        "area_id": area_id
    }, headers=security_headers)
    assert res_inc_low.status_code == 201
    assert res_inc_low.json()["severity_level"] == "medium"
    
    # Assert no auto-escalated task was created (since level is medium, not high/critical)
    res_tasks_low = client.get("/api/v1/staff/tasks")
    assert len(res_tasks_low.json()) == 0

    # 4. Ingest high density telemetry (900 count / 1000 capacity = 90% occupancy)
    client.post("/api/v1/crowd/telemetry", json={"area_id": area_id, "count": 900})

    # Test Case B: High/Critical Severity (Medical incident, 90% density)
    # Score formula: 2.5 (medical) * 1.9 (density: 1 + 0.9) * 1.0 (time) = 4.75 -> "high"
    res_inc_high = client.post("/api/v1/incidents/", json={
        "title": "Heart attack",
        "description": "Chest pain under high crowd stress",
        "type": "medical",
        "area_id": area_id
    }, headers=security_headers)
    assert res_inc_high.status_code == 201
    assert res_inc_high.json()["severity_level"] == "high"
    incident_id = res_inc_high.json()["id"]

    # Assert that an auto-escalated task was created and automatically assigned to the Medical specialist!
    res_tasks_high = client.get("/api/v1/staff/tasks")
    assert len(res_tasks_high.json()) == 1
    escalated_task = res_tasks_high.json()[0]
    assert escalated_task["title"] == "[ALERT] Auto-Escalated: Heart attack"
    assert f"Incident #{incident_id}" in escalated_task["description"]
    assert escalated_task["assigned_staff_id"] == staff_id
    assert escalated_task["status"] == "open"

    # 5. Manual Override: Elevate "Faint fan" (incident_id_low = 1) from medium to critical
    res_override = client.patch(f"/api/v1/incidents/{res_inc_low.json()['id']}/override", json={
        "severity_level": "critical"
    }, headers=admin_headers)
    assert res_override.status_code == 200
    assert res_override.json()["severity_level"] == "critical"
    assert res_override.json()["is_overridden"] is True

    # Assert that a task has now been auto-created for Faint fan too due to the override!
    res_tasks_override = client.get("/api/v1/staff/tasks")
    assert len(res_tasks_override.json()) == 2
    
    # 6. Resolution Cascade: Resolve incident B (incident_id)
    # Should automatically close (mark "done") the related task!
    res_resolve = client.patch(f"/api/v1/incidents/{incident_id}/status", json={"status": "resolved"}, headers=admin_headers)
    assert res_resolve.status_code == 200
    assert res_resolve.json()["status"] == "resolved"

    # Assert related task status updated to done
    res_tasks_final = client.get("/api/v1/staff/tasks")
    task_b = [t for t in res_tasks_final.json() if "Heart attack" in t["title"]][0]
    assert task_b["status"] == "done"

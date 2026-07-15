import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from services.gateway.database import Base, get_db
from services.gateway.main import app
from services.auth.models import User
from services.staff.models import Staff, Shift, Task

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

def test_staff_management_flow():
    admin_headers = get_auth_header("admin@stadium.com", "Admin Boss", "admin")
    staff_user_headers = get_auth_header("volunteer@stadium.com", "Officer Jones", "staff")

    # Get staff user record id from login profile endpoint
    res_me = client.get("/api/v1/auth/me", headers=staff_user_headers)
    assert res_me.status_code == 200
    user_id = res_me.json()["id"]

    # 1. Create a Staff profile (Admin only)
    res_profile = client.post("/api/v1/staff/profile", json={
        "user_id": user_id,
        "role_specialty": "Security"
    }, headers=admin_headers)
    assert res_profile.status_code == 201
    staff_id = res_profile.json()["id"]

    # Try duplicate profile creation (Should fail 400)
    res_dup = client.post("/api/v1/staff/profile", json={
        "user_id": user_id,
        "role_specialty": "Security"
    }, headers=admin_headers)
    assert res_dup.status_code == 400
    assert res_dup.json()["code"] == "STAFF_ALREADY_EXISTS"

    # 2. Schedule a Shift
    start_time = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    end_time = datetime.datetime.utcnow() + datetime.timedelta(hours=5)
    res_shift = client.post("/api/v1/staff/shifts", json={
        "staff_id": staff_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "zone": "Gate A Concourse"
    }, headers=admin_headers)
    assert res_shift.status_code == 201
    assert res_shift.json()["zone"] == "Gate A Concourse"

    # 3. Create a Task
    res_task = client.post("/api/v1/staff/tasks", json={
        "assigned_staff_id": staff_id,
        "title": "Inspect turnstiles Gate A",
        "description": "Ensure BLE scanners read correctly"
    }, headers=admin_headers)
    assert res_task.status_code == 201
    task_id = res_task.json()["id"]
    assert res_task.json()["status"] == "open"

    # 4. Constrained Status Transitions: open -> in-progress -> done
    # Attempt invalid jump: open -> done (Should fail 400)
    res_jump = client.patch(f"/api/v1/staff/tasks/{task_id}", json={"status": "done"}, headers=staff_user_headers)
    assert res_jump.status_code == 400
    assert res_jump.json()["code"] == "INVALID_STATUS_TRANSITION"

    # Valid step 1: open -> in-progress
    res_step1 = client.patch(f"/api/v1/staff/tasks/{task_id}", json={"status": "in-progress"}, headers=staff_user_headers)
    assert res_step1.status_code == 200
    assert res_step1.json()["status"] == "in-progress"

    # Valid step 2: in-progress -> done
    res_step2 = client.patch(f"/api/v1/staff/tasks/{task_id}", json={"status": "done"}, headers=staff_user_headers)
    assert res_step2.status_code == 200
    assert res_step2.json()["status"] == "done"

def test_websocket_realtime_and_backlog():
    admin_headers = get_auth_header("admin@stadium.com", "Admin Boss", "admin")
    staff_user_headers = get_auth_header("volunteer@stadium.com", "Officer Jones", "staff")

    res_me = client.get("/api/v1/auth/me", headers=staff_user_headers)
    user_id = res_me.json()["id"]

    res_profile = client.post("/api/v1/staff/profile", json={
        "user_id": user_id,
        "role_specialty": "Concession"
    }, headers=admin_headers)
    staff_id = res_profile.json()["id"]

    # Pre-create an outstanding task to test WebSocket backlog sync on connection
    client.post("/api/v1/staff/tasks", json={
        "assigned_staff_id": staff_id,
        "title": "Offline Task 1"
    }, headers=admin_headers)

    # Establish WebSocket connection
    with client.websocket_connect(f"/api/v1/staff/ws/{staff_id}") as websocket:
        # Assert backlog sync is immediately sent on connection
        backlog_data = websocket.receive_json()
        assert backlog_data["event"] == "backlog_sync"
        assert len(backlog_data["data"]) == 1
        assert backlog_data["data"][0]["title"] == "Offline Task 1"

        # While connected, assign a new task to test real-time push notification
        client.post("/api/v1/staff/tasks", json={
            "assigned_staff_id": staff_id,
            "title": "Live Task 2"
        }, headers=admin_headers)

        # Assert task_assigned notification pushed immediately
        push_data = websocket.receive_json()
        assert push_data["event"] == "task_assigned"
        assert push_data["data"]["title"] == "Live Task 2"

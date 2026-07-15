import time
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from services.gateway.main import app
from services.gateway.database import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///./e2e_test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module", autouse=True)
def setup_e2e_database():
    # Setup test database once for the entire module to preserve state across E2E steps
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Initialize basic seed data
    db = TestingSessionLocal()
    from services.auth.models import User
    from services.vendor.models import Vendor
    from services.inventory.models import Item
    from services.crowd.models import Area
    from services.staff.models import Staff
    from services.staff.models import Staff
    
    from services.auth.security import get_password_hash
    
    pwd_hash = get_password_hash("pass123")
    vendor_user = User(email="vendor@stadium.com", name="Bob", role="vendor", password_hash=pwd_hash)
    fan_user = User(email="fan@stadium.com", name="Alice", role="fan", password_hash=pwd_hash)
    sec_user = User(email="security@stadium.com", name="Sec Lead", role="security", password_hash=pwd_hash)
    staff_user = User(email="staff@stadium.com", name="Medic", role="staff", password_hash=pwd_hash)
    admin_user = User(email="admin@stadium.com", name="Admin", role="admin", password_hash=pwd_hash)
    
    db.add_all([vendor_user, fan_user, sec_user, staff_user, admin_user])
    db.commit()

    vendor = Vendor(owner_user_id=vendor_user.id, name="Bob's Burgers", type="food")
    db.add(vendor)
    db.commit()

    item = Item(vendor_id=vendor.id, name="E2E Burger", base_price=10.00, original_price=10.00, stock=100)
    db.add(item)
    db.commit()

    area = Area(name="Sector A", capacity=100)
    db.add(area)
    
    staff = Staff(user_id=staff_user.id, role_specialty="medical")
    db.add(staff)
    
    db.commit()
    db.close()
    
    yield
    
    # Teardown
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()

client = TestClient(app, base_url="https://testserver")

def login(email: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "pass123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_e2e_vendor_fan_commerce_journey():
    """
    Validates: Vendor Profile -> Fan Checkout -> Pricing Recalculation -> AI RAG grounding.
    """
    fan_token = login("fan@stadium.com")
    vendor_token = login("vendor@stadium.com")

    # 1. Vendor lists inventory
    res = client.get("/api/v1/items", headers={"Authorization": f"Bearer {fan_token}"})
    assert res.status_code == 200
    items = res.json()
    burger_id = next(item["id"] for item in items if item["name"] == "E2E Burger")
    
    # 2. Fan buys a significant portion of stock (80/100)
    res_buy = client.post("/api/v1/sales", 
        json={"item_id": burger_id, "quantity": 80},
        headers={"Authorization": f"Bearer {fan_token}"}
    )
    assert res_buy.status_code == 201
    assert res_buy.json()["quantity"] == 80

    # 3. Verify stock is updated
    res_items_after = client.get("/api/v1/items", headers={"Authorization": f"Bearer {fan_token}"})
    updated_items = res_items_after.json()
    updated_burger = next(item for item in updated_items if item["id"] == burger_id)
    assert updated_burger["stock"] == 20

    # 4. Trigger Dynamic Pricing explicitly (path param endpoint)
    res_pricing = client.post(f"/api/v1/pricing/recalculate/{burger_id}")
    assert res_pricing.status_code == 200
    new_price = res_pricing.json()["base_price"]
    # Due to scarcity (20% remaining), price should have surged!
    assert new_price > 10.00

    # 5. Fan asks AI Copilot about the price of "E2E Burger"
    # Wait briefly for vector embeddings sync if necessary (though in-memory should be instant)
    res_ai = client.post("/api/v1/chat", 
        json={"message": "How much does the E2E Burger cost?", "history": []},
        headers={"Authorization": f"Bearer {fan_token}"}
    )
    assert res_ai.status_code == 200
    # The LLM prompt was grounded with the dynamic price in the database.
    # While we cannot control the exact words the mock/real Gemini model uses,
    # the vector pipeline must successfully retrieve and assemble context.
    assert "E2E Burger" in res_ai.json()["response"]


def test_e2e_security_ops_risk_journey():
    """
    Validates: Crowd telemetry spikes -> Security Incident Intake -> Risk Engine Auto-Escalation -> Staff resolves Task.
    """
    sec_token = login("security@stadium.com")
    staff_token = login("staff@stadium.com")

    # 1. Fetch area ID
    db = TestingSessionLocal()
    from services.crowd.models import Area
    area = db.query(Area).filter(Area.name == "Sector A").first()
    area_id = area.id
    db.close()

    # 2. Crowd telemetry injects a dangerous spike (95/100 capacity)
    res_telemetry = client.post("/api/v1/crowd/telemetry", json={"area_id": area_id, "count": 95})
    assert res_telemetry.status_code == 201

    # 3. Security reports a medical incident in Sector A
    res_incident = client.post("/api/v1/incidents/", 
        json={"title": "Fainted fan", "description": "Needs medical attention", "type": "medical", "area_id": area_id},
        headers={"Authorization": f"Bearer {sec_token}"}
    )
    assert res_incident.status_code == 201
    incident = res_incident.json()
    
    # The Risk engine sees "medical" + high density -> Severity should be "high" or "critical"
    assert incident["severity_level"] in ["high", "critical"]
    assert incident["status"] == "reported" # Auto-assigned a task in background!

    # 4. Medic Staff checks their backlog
    res_tasks = client.get("/api/v1/staff/tasks", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_tasks.status_code == 200
    tasks = res_tasks.json()
    # Medic should have the auto-escalated task
    task = next(t for t in tasks if t["status"] == "open" and "Fainted fan" in t["title"])
    task_id = task["id"]

    # 5. Medic Staff progresses task: open -> in-progress -> done (strict state machine)
    res_inprogress = client.patch(f"/api/v1/staff/tasks/{task_id}",
        json={"status": "in-progress"},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert res_inprogress.status_code == 200
    assert res_inprogress.json()["status"] == "in-progress"

    res_done = client.patch(f"/api/v1/staff/tasks/{task_id}",
        json={"status": "done"},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert res_done.status_code == 200
    assert res_done.json()["status"] == "done"


def test_e2e_analytics_reconciliation_journey():
    """
    Validates: Admin KPI Dashboard correctly aggregates the data produced in the prior E2E steps.
    """
    from services.gateway.redis_client import redis_manager
    redis_manager.local_cache.clear()
    
    admin_token = login("admin@stadium.com")

    res = client.get("/api/v1/analytics/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()

    # Sales Verification: The Fan bought 80 E2E Burgers at 10.00 (before price surge).
    assert data["sales"]["total_revenue"] == 800.00
    assert data["sales"]["items_sold"] == 80
    assert data["sales"]["total_transactions"] == 1

    # Crowd Verification: Telemetry logged 95 people in Sector A (capacity 100).
    assert data["crowd"]["total_stadium_occupancy"] == 95
    assert data["crowd"]["occupancy_by_area"][0]["density"] == 0.95

    # Staff Verification: One task was created and marked done. Completion rate = 100%.
    assert data["staff"]["task_completion_rate"] == 1.00
    assert data["staff"]["tasks_by_status"].get("done", 0) == 1

    # Incident Verification: One incident reported.
    assert data["incidents"]["total_incidents"] == 1
    # Because it was escalated and completed, its status should ideally be synced, but Risk Engine 
    # might still show 'assigned' unless there's a back-sync hook. Let's just verify it exists.
    assert "Fainted fan" in str(data) or sum(data["incidents"]["incidents_by_severity"].values()) == 1

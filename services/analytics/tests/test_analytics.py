import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from services.gateway.database import Base, get_db
from services.gateway.main import app
from services.auth.models import User
from services.inventory.models import Item, Sale
from services.crowd.models import Area, CrowdData
from services.staff.models import Staff, Shift, Task
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
    from services.gateway.redis_client import redis_manager
    redis_manager.local_cache.clear()
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

def test_analytics_rbac_gating():
    # Standard vendor tokens should be forbidden
    vendor_headers = get_auth_header("priya@stadium.com", "Priya Sen", "vendor")
    res = client.get("/api/v1/analytics/dashboard", headers=vendor_headers)
    assert res.status_code == 403

    # Admin tokens should be permitted
    admin_headers = get_auth_header("admin@stadium.com", "Admin Boss", "admin")
    res_admin = client.get("/api/v1/analytics/dashboard", headers=admin_headers)
    assert res_admin.status_code == 200


def test_analytics_aggregations_reconciliation():
    admin_headers = get_auth_header("admin@stadium.com", "Admin Boss", "admin")
    db = TestingSessionLocal()

    # 1. Seed Concession Sales
    item_1 = Item(vendor_id=1, name="Burgers", base_price=12.00, original_price=10.00, stock=80)
    item_2 = Item(vendor_id=1, name="Fries", base_price=5.00, original_price=4.50, stock=150)
    db.add_all([item_1, item_2])
    db.commit()

    sale_1 = Sale(item_id=item_1.id, quantity=3, price_at_sale=12.00, timestamp=datetime.datetime.utcnow())
    sale_2 = Sale(item_id=item_2.id, quantity=5, price_at_sale=5.00, timestamp=datetime.datetime.utcnow())
    db.add_all([sale_1, sale_2])
    db.commit()

    # 2. Seed Crowd occupancy
    area_a = Area(name="Sector A North", capacity=500)
    area_b = Area(name="Sector B South", capacity=800)
    db.add_all([area_a, area_b])
    db.commit()

    crowd_a = CrowdData(area_id=area_a.id, count=120, timestamp=datetime.datetime.utcnow())
    crowd_b = CrowdData(area_id=area_b.id, count=450, timestamp=datetime.datetime.utcnow())
    db.add_all([crowd_a, crowd_b])

    # 3. Seed Staff and Tasks
    staff = Staff(user_id=1, role_specialty="medical")
    db.add(staff)
    db.commit()
    
    task_1 = Task(assigned_staff_id=staff.id, title="Water spill", description="Clean up", status="done", created_at=datetime.datetime.utcnow())
    task_2 = Task(assigned_staff_id=staff.id, title="Help fan", description="Direct fan", status="open", created_at=datetime.datetime.utcnow())
    db.add_all([task_1, task_2])

    # 4. Seed Incidents
    incident_1 = Incident(title="Minor spill", type="general", area_id=area_a.id, severity_score=2.0, severity_level="low", status="assigned", created_at=datetime.datetime.utcnow())
    incident_2 = Incident(title="Flipped rail", type="security", area_id=area_b.id, severity_score=7.0, severity_level="high", status="reported", created_at=datetime.datetime.utcnow())
    db.add_all([incident_1, incident_2])

    db.commit()
    db.close()

    # Query dashboard and reconcile results
    res = client.get("/api/v1/analytics/dashboard", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    # Reconcile Sales: Revenue = 3*12 + 5*5 = 36 + 25 = 61.00
    assert data["sales"]["total_revenue"] == 61.00
    assert data["sales"]["total_transactions"] == 2
    assert data["sales"]["items_sold"] == 8
    
    burgers_sales = next(item for item in data["sales"]["sales_by_item"] if item["item_name"] == "Burgers")
    assert burgers_sales["revenue"] == 36.00
    assert burgers_sales["quantity_sold"] == 3

    # Reconcile Crowd: Occupancy = 120 + 450 = 570
    assert data["crowd"]["total_stadium_occupancy"] == 570
    assert len(data["crowd"]["occupancy_by_area"]) == 2

    # Reconcile Staff: Tasks = 1 open, 1 done -> 50% rate
    assert data["staff"]["task_completion_rate"] == 0.50
    assert data["staff"]["tasks_by_status"]["done"] == 1
    assert data["staff"]["tasks_by_status"]["open"] == 1

    # Reconcile Incidents: 2 total, 1 low, 1 high
    assert data["incidents"]["total_incidents"] == 2
    assert data["incidents"]["incidents_by_severity"]["high"] == 1
    assert data["incidents"]["incidents_by_severity"]["low"] == 1


def test_analytics_redis_cache():
    from services.gateway.redis_client import redis_manager
    redis_manager.local_cache.clear()

    admin_headers = get_auth_header("admin@stadium.com", "Admin Boss", "admin")

    # First fetch: should execute queries directly and result in cached=False
    res1 = client.get("/api/v1/analytics/dashboard", headers=admin_headers)
    assert res1.status_code == 200
    assert res1.json()["cached"] is False

    # Second fetch immediately: should retrieve values from Redis and result in cached=True
    res2 = client.get("/api/v1/analytics/dashboard", headers=admin_headers)
    assert res2.status_code == 200
    assert res2.json()["cached"] is True

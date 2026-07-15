import concurrent.futures
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from services.gateway.database import Base, get_db
from services.gateway.main import app
from services.auth.models import User
from services.vendor.models import Vendor
from services.inventory.models import Item, Sale

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
    # Helper to register, login and return header
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

def test_vendor_and_inventory_flow():
    vendor_headers = get_auth_header("priya.vendor@stadium.com", "Priya", "vendor")
    admin_headers = get_auth_header("admin@stadium.com", "Admin", "admin")

    # 1. Create a Vendor profile
    vendor_payload = {
        "name": "Priya Concessions",
        "type": "Food"
    }
    res_vendor = client.post("/api/v1/vendors/", json=vendor_payload, headers=vendor_headers)
    assert res_vendor.status_code == 201
    vendor_id = res_vendor.json()["id"]

    # 2. Add an Item to catalog
    item_payload = {
        "vendor_id": vendor_id,
        "name": "Giant Hotdog",
        "base_price": 8.50,
        "stock": 100
    }
    res_item = client.post("/api/v1/items", json=item_payload, headers=vendor_headers)
    assert res_item.status_code == 201
    item_id = res_item.json()["id"]

    # 3. Create another user to verify ownership restrictions
    other_headers = get_auth_header("other.vendor@stadium.com", "Other", "vendor")
    res_fail_item = client.post("/api/v1/items", json={
        "vendor_id": vendor_id,
        "name": "Stolen Hotdog",
        "base_price": 5.00,
        "stock": 10
    }, headers=other_headers)
    assert res_fail_item.status_code == 403
    assert res_fail_item.json()["code"] == "FORBIDDEN"

    # 4. List items
    res_list = client.get("/api/v1/items")
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1

    # 5. Record POS checkout sale
    sale_payload = {
        "item_id": item_id,
        "quantity": 2
    }
    res_sale = client.post("/api/v1/sales", json=sale_payload, headers=vendor_headers)
    assert res_sale.status_code == 201
    assert res_sale.json()["quantity"] == 2
    assert res_sale.json()["price_at_sale"] == 8.50

    # Verify stock decremented
    res_check_item = client.get("/api/v1/items")
    assert res_check_item.json()[0]["stock"] == 98

def test_concurrency_load_checkout():
    vendor_headers = get_auth_header("priya.vendor@stadium.com", "Priya", "vendor")

    # Create vendor and catalog item with exactly 10 units in stock
    res_vendor = client.post("/api/v1/vendors/", json={
        "name": "Priya Concessions",
        "type": "Food"
    }, headers=vendor_headers)
    vendor_id = res_vendor.json()["id"]

    res_item = client.post("/api/v1/items", json={
        "vendor_id": vendor_id,
        "name": "Limited Souvenir Cup",
        "base_price": 12.00,
        "stock": 10
    }, headers=vendor_headers)
    item_id = res_item.json()["id"]

    # We will submit 12 concurrent sales calls purchasing 1 unit each.
    # Exactly 10 should succeed, 2 should fail with 400 Insufficient Stock.
    results = []

    def make_sale_request():
        # Spawn a new TestClient instance per thread to simulate concurrent client sessions
        with TestClient(app, base_url="https://testserver") as thread_client:
            return thread_client.post("/api/v1/sales", json={
                "item_id": item_id,
                "quantity": 1
            }, headers=vendor_headers)

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        futures = [executor.submit(make_sale_request) for _ in range(12)]
        for fut in concurrent.futures.as_completed(futures):
            res = fut.result()
            results.append(res)

    successes = [r for r in results if r.status_code == 201]
    failures = [r for r in results if r.status_code == 400]

    # Verify atomic concurrency outcomes
    assert len(successes) == 10, f"Expected 10 successful checkouts, got {len(successes)}"
    assert len(failures) == 2, f"Expected 2 failures due to insufficient stock, got {len(failures)}"
    for fail in failures:
        assert fail.json()["code"] == "INSUFFICIENT_STOCK"

    # Verify final stock is exactly 0 (no double-spend or negative counts)
    res_check_item = client.get("/api/v1/items")
    assert res_check_item.json()[0]["stock"] == 0

import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from services.gateway.database import Base, get_db
from services.gateway.main import app
from services.auth.models import User
from services.inventory.models import Item, Sale
from services.pricing.models import PriceHistory

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

def test_dynamic_pricing_calculations_and_cooldown():
    admin_headers = get_auth_header("admin@stadium.com", "Admin Boss", "admin")
    vendor_headers = get_auth_header("priya@stadium.com", "Priya Sen", "vendor")

    # 1. Register a Vendor profile
    client.post("/api/v1/vendors", json={
        "name": "Priya Concessions",
        "type": "Food"
    }, headers=vendor_headers)

    # 2. Add catalog concessions Item (stock = 100, base_price = 10.00)
    res_item = client.post("/api/v1/items", json={
        "vendor_id": 1,
        "name": "Hot Dog Combo",
        "base_price": 10.00,
        "stock": 100
    }, headers=vendor_headers)
    item_id = res_item.json()["id"]

    # 3. Simulate low/no sales velocity checkout (1 Hot Dog Combo)
    # The pricing engine is triggered automatically on POS checkout.
    # Scarcity factor: 1.0 (stock = 99 >= 50)
    # Velocity factor: 1.0 + (1/5)*0.2 = 1.04
    # Expected Price: 10.00 * 1.0 * 1.04 = 10.40
    res_checkout_1 = client.post("/api/v1/sales", json={
        "item_id": item_id,
        "quantity": 1
    }, headers=vendor_headers)
    assert res_checkout_1.status_code == 201

    # Verify that the price was dynamically updated to 10.40 in the item catalog!
    res_item_check1 = client.get("/api/v1/items")
    item_1 = res_item_check1.json()[0]
    assert item_1["base_price"] == 10.40

    # 4. Anti-Oscillation Cooldown Gate check:
    # Perform another checkout immediately. Since elapsed time is < 30 seconds,
    # the pricing engine MUST skip recalculation and lock the price to 10.40!
    res_checkout_2 = client.post("/api/v1/sales", json={
        "item_id": item_id,
        "quantity": 10
    }, headers=vendor_headers)
    assert res_checkout_2.status_code == 201

    res_item_check2 = client.get("/api/v1/items")
    item_2 = res_item_check2.json()[0]
    # Price remains 10.40 due to cooldown lock!
    assert item_2["base_price"] == 10.40

    # 5. Cooldown Expired bypass:
    # Programmatically update the latest PriceHistory log timestamp in SQLite to 1 minute ago to bypass cooldown
    db = TestingSessionLocal()
    history_log = db.query(PriceHistory).filter(PriceHistory.item_id == item_id).first()
    assert history_log is not None
    history_log.timestamp = datetime.datetime.utcnow() - datetime.timedelta(seconds=45)
    db.commit()
    db.close()

    # Now run another checkout (10 units), which depletes stock to 78.
    # Stock scarcity: still >= 50, factor = 1.0
    # Velocity: (10 units + 1 unit + 10 units) = 21 units in last 5 min.
    # Velocity factor: 1.0 + (21/5)*0.2 = 1.0 + 0.84 = 1.84
    # Expected Price: 10.00 * 1.0 * 1.84 = 18.40
    res_checkout_3 = client.post("/api/v1/sales", json={
        "item_id": item_id,
        "quantity": 10
    }, headers=vendor_headers)
    assert res_checkout_3.status_code == 201

    res_item_check3 = client.get("/api/v1/items")
    item_3 = res_item_check3.json()[0]
    # Verify price recalculated successfully to 18.40!
    assert item_3["base_price"] == 18.40


def test_pricing_demand_forecaster():
    vendor_headers = get_auth_header("priya@stadium.com", "Priya Sen", "vendor")
    
    # Setup vendor and item
    client.post("/api/v1/vendors", json={"name": "Priya Concessions", "type": "Food"}, headers=vendor_headers)
    res_item = client.post("/api/v1/items", json={
        "vendor_id": 1,
        "name": "Soda",
        "base_price": 4.00,
        "stock": 60
    }, headers=vendor_headers)
    item_id = res_item.json()["id"]

    # Forecast simulation request: 30 sodas projected to sell.
    # Projected velocity: 30 / 5 = 6 units/min -> demand factor = 1.0 + min(6 * 0.2, 1.0) = 2.0
    # Projected stock: 60 - 30 = 30 -> scarcity factor = 1.0 + (50 - 30)*0.01 = 1.2
    # Expected dynamic forecast price: 4.00 * 1.2 * 2.0 = 9.60
    res_forecast = client.post("/api/v1/pricing/forecast", json={
        "item_id": item_id,
        "projected_sales_quantity": 30
    })
    assert res_forecast.status_code == 200
    assert res_forecast.json()["projected_price"] == 9.60
    assert "checkouts of 30 items" in res_forecast.json()["confidence_basis"]


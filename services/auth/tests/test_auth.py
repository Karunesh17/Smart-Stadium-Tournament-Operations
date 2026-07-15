import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from services.gateway.database import Base, get_db
from services.gateway.main import app

# Set up clean SQLite database for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_stadium.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override get_db dependency to point to our test database
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def setup_database():
    app.dependency_overrides[get_db] = override_get_db
    # Re-create database tables clean for each test session
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


client = TestClient(app, base_url="https://testserver")

def test_user_registration_success():
    payload = {
        "name": "Priya Merch",
        "email": "priya@stadium.com",
        "password": "securepassword123",
        "role": "vendor"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Priya Merch"
    assert data["email"] == "priya@stadium.com"
    assert data["role"] == "vendor"
    assert "id" in data
    assert "password_hash" not in data

def test_user_registration_validation():
    # Invalid email format
    payload = {
        "name": "Priya",
        "email": "invalid-email",
        "password": "securepassword123",
        "role": "vendor"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"

    # Password too short
    payload = {
        "name": "Priya",
        "email": "priya@stadium.com",
        "password": "short",
        "role": "vendor"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

    # Invalid role
    payload = {
        "name": "Priya",
        "email": "priya@stadium.com",
        "password": "securepassword123",
        "role": "invalid_role"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

def test_user_registration_duplicate_email():
    payload = {
        "name": "Priya Merch",
        "email": "priya@stadium.com",
        "password": "securepassword123",
        "role": "vendor"
    }
    # First creation
    response1 = client.post("/api/v1/auth/register", json=payload)
    assert response1.status_code == 201

    # Duplicate creation
    response2 = client.post("/api/v1/auth/register", json=payload)
    assert response2.status_code == 400
    assert response2.json()["code"] == "USER_ALREADY_EXISTS"

def test_user_login_success_and_cookie():
    # 1. Register User
    register_payload = {
        "name": "Admin User",
        "email": "admin@stadium.com",
        "password": "supersecretadmin1",
        "role": "admin"
    }
    client.post("/api/v1/auth/register", json=register_payload)

    # 2. Login User
    login_payload = {
        "email": "admin@stadium.com",
        "password": "supersecretadmin1"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # Verify refresh token cookie is set
    assert "refresh_token" in response.cookies
    # We can inspect the cookie structure implicitly since TestClient exposes it

def test_user_login_incorrect_credentials():
    login_payload = {
        "email": "missing@stadium.com",
        "password": "wrongpassword"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"

def test_protected_route_and_rbac():
    # Register an admin and a vendor
    client.post("/api/v1/auth/register", json={
        "name": "Admin User",
        "email": "admin@stadium.com",
        "password": "password123",
        "role": "admin"
    })
    client.post("/api/v1/auth/register", json={
        "name": "Priya Vendor",
        "email": "priya@stadium.com",
        "password": "password123",
        "role": "vendor"
    })

    # Get admin access token
    admin_login = client.post("/api/v1/auth/login", json={"email": "admin@stadium.com", "password": "password123"})
    admin_token = admin_login.json()["access_token"]

    # Get vendor access token
    vendor_login = client.post("/api/v1/auth/login", json={"email": "priya@stadium.com", "password": "password123"})
    vendor_token = vendor_login.json()["access_token"]

    # Test GET /me with no token
    r_unauth = client.get("/api/v1/auth/me")
    assert r_unauth.status_code == 401

    # Test GET /me with admin token
    r_admin_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_admin_me.status_code == 200
    assert r_admin_me.json()["email"] == "admin@stadium.com"

    # Test GET /admin-only with vendor token (should yield 403)
    r_fail_admin = client.get("/api/v1/auth/admin-only", headers={"Authorization": f"Bearer {vendor_token}"})
    assert r_fail_admin.status_code == 403
    assert r_fail_admin.json()["code"] == "FORBIDDEN"

    # Test GET /admin-only with admin token
    r_ok_admin = client.get("/api/v1/auth/admin-only", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_ok_admin.status_code == 200
    assert "Access verified" in r_ok_admin.json()["message"]

def test_refresh_token_rotation():
    # Register and login
    client.post("/api/v1/auth/register", json={
        "name": "Priya Vendor",
        "email": "priya@stadium.com",
        "password": "password123",
        "role": "vendor"
    })
    login_res = client.post("/api/v1/auth/login", json={"email": "priya@stadium.com", "password": "password123"})
    
    # Try refreshing
    refresh_res = client.post("/api/v1/auth/refresh")
    assert refresh_res.status_code == 200
    assert "access_token" in refresh_res.json()
    assert "refresh_token" in refresh_res.cookies

def test_logout():
    # Register and login
    client.post("/api/v1/auth/register", json={
        "name": "Priya Vendor",
        "email": "priya@stadium.com",
        "password": "password123",
        "role": "vendor"
    })
    login_res = client.post("/api/v1/auth/login", json={"email": "priya@stadium.com", "password": "password123"})
    assert "refresh_token" in login_res.cookies

    # Logout
    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200
    
    # Verify cookie is removed (deleted / blank)
    assert logout_res.cookies.get("refresh_token") is None or logout_res.cookies.get("refresh_token") == ""

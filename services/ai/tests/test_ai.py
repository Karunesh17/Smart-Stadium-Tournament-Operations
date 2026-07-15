import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from services.gateway.database import Base, get_db
from services.gateway.main import app
from services.inventory.models import Item
from services.ai.qdrant_manager import get_deterministic_embedding

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

def test_deterministic_embedding_l2_normalization():
    emb = get_deterministic_embedding("refund limit price")
    assert len(emb) == 128
    
    # Calculate sum of squares (should equal 1.0 due to L2 normalization)
    sum_squares = sum(x**2 for x in emb)
    assert abs(sum_squares - 1.0) < 1e-5


def test_ai_copilot_policy_retrieval_rag():
    # 1. Ask about refund rules (should match Vector DB policy document)
    res = client.post("/api/v1/chat/", json={
        "message": "What is the refund policy?",
        "role": "vendor"
    })
    assert res.status_code == 200
    data = res.json()
    assert "Vendors may refund items within 15 minutes" in data["response"]
    
    sources = [s["source"] for s in data["sources"]]
    assert "policy_refunds" in sources


def test_ai_copilot_dynamic_database_grounding():
    # Insert an item into the database to query grounding
    db = TestingSessionLocal()
    new_item = Item(
        vendor_id=1,
        name="Giant Pretzel",
        base_price=6.50,
        original_price=6.50,
        stock=42
    )
    db.add(new_item)
    db.commit()
    db.close()

    # Query the Copilot about Giant Pretzel stock levels (vendor context)
    res = client.post("/api/v1/chat/", json={
        "message": "How many Giant Pretzel items are left in stock?",
        "role": "vendor"
    })
    assert res.status_code == 200
    data = res.json()
    assert "Giant Pretzel" in data["response"]
    assert "42 units left" in data["response"]
    assert "$6.50" in data["response"]

    sources = [s["source"] for s in data["sources"]]
    assert "database_inventory" in sources


def test_ai_copilot_sse_streaming_response():
    # Request token streaming SSE endpoint
    res = client.get("/api/v1/chat/stream?message=refunds&role=vendor")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")

    # Read lines of stream and parse SSE chunks
    lines = res.text.split("\n\n")
    tokens = []
    has_done = False
    has_sources = False

    for line in lines:
        if line.startswith("data: "):
            payload = json.loads(line[6:])
            if payload["token"]:
                tokens.append(payload["token"])
            if payload["done"]:
                has_done = True
                if len(payload["sources"]) > 0:
                    has_sources = True

    complete_text = "".join(tokens)
    assert len(complete_text) > 0
    assert "refund" in complete_text.lower()
    assert has_done is True
    assert has_sources is True

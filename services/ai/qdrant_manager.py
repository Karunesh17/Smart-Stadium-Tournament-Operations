import hashlib
import numpy as np
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

# 128-dimensional embedding model generator
def get_deterministic_embedding(text: str) -> List[float]:
    vector = np.zeros(128)
    words = text.lower().split()
    if not words:
        # Return blank unit vector
        vector[0] = 1.0
        return vector.tolist()
    
    for word in words:
        h = hashlib.sha256(word.encode("utf-8")).digest()
        # Feed byte values into indices deterministically
        for i in range(len(h)):
            idx = (i * 7) % 128
            vector[idx] += h[i]

    # L2 normalize
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    return vector.tolist()


class StadiumQdrantManager:
    def __init__(self):
        # Local, in-memory instance: does not require a docker engine
        self.client = QdrantClient(":memory:")
        self.collection_name = "stadium_policies"
        self._initialize_collection()

    def _initialize_collection(self):
        # Create collection
        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=128,
                distance=Distance.COSINE
            )
        )

        # Seed data
        policies = [
            {
                "id": 1,
                "title": "Vendor Refund Policy",
                "content": "Vendor Refund Policy: Vendors may refund items within 15 minutes of checkout if item is unused and receipt is provided. No cash refunds on alcohol.",
                "source": "policy_refunds",
                "section": "refunds"
            },
            {
                "id": 2,
                "title": "Inventory Stock Limit Policy",
                "content": "Inventory Stock Limit Policy: Concessions must maintain at least 10 units of critical inventory. Running out triggers a warning badge.",
                "source": "policy_inventory",
                "section": "stock_limits"
            },
            {
                "id": 3,
                "title": "Dynamic Pricing Policy",
                "content": "Dynamic Pricing Policy: Prices surge up to 2.5x base floor price based on sales speed (velocity) in a 5-minute window and scarcity below 50 units.",
                "source": "policy_pricing",
                "section": "surges"
            }
        ]

        points = []
        for policy in policies:
            vector = get_deterministic_embedding(policy["content"])
            points.append(
                PointStruct(
                    id=policy["id"],
                    vector=vector,
                    payload={
                        "title": policy["title"],
                        "content": policy["content"],
                        "source": policy["source"],
                        "section": policy["section"],
                        "updated_at": "2026-06-01"
                    }
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )

    def search_policies(self, query: str, limit: int = 2) -> List[Dict[str, Any]]:
        query_vector = get_deterministic_embedding(query)
        results_response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=limit
        )
        results = results_response.points
        return [
            {
                "score": hit.score,
                "title": hit.payload["title"],
                "content": hit.payload["content"],
                "source": hit.payload["source"],
                "section": hit.payload["section"],
                "updated_at": hit.payload["updated_at"]
            }
            for hit in results
        ]


stadium_qdrant = StadiumQdrantManager()

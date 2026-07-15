import os
import json
import asyncio
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from libs.shared_schemas.ai import ChatRequest, ChatResponse
from services.gateway.database import get_db
from services.ai.qdrant_manager import stadium_qdrant
from services.inventory.models import Item
from services.auth.models import User
from services.auth.security import get_current_user

router = APIRouter()

# Session memory thread context cache
sessions_memory: Dict[str, List[Dict[str, str]]] = {}

# Simple RAG response synthesis logic (Fallback/Local mode)
def generate_local_response(message: str, role: str, db: Session):
    response_text = ""
    sources = []

    # 1. Query local Qdrant Vector DB for policies
    hits = stadium_qdrant.search_policies(message, limit=2)
    matched_policies = []
    for hit in hits:
        # Check cosine similarity threshold
        if hit["score"] > 0.35:
            matched_policies.append(hit)

    # 2. Query database for live inventory metrics if the user is a vendor
    item_context = []
    if role == "vendor" or "stock" in message.lower() or "price" in message.lower() or "sale" in message.lower():
        db_items = db.query(Item).all()
        for item in db_items:
            # If item name matches query word
            if item.name.lower() in message.lower():
                item_context.append(
                  f"{item.name} currently has {item.stock} units left, priced at ${item.base_price:.2f} (base: ${item.original_price or item.base_price:.2f})."
                )
                
    if item_context:
        sources.append({
            "title": "Live Concessions Inventory",
            "source": "database_inventory",
            "section": "catalog"
        })

    for policy in matched_policies:
        sources.append({
            "title": policy["title"],
            "source": policy["source"],
            "section": policy["section"]
        })

    # Assemble response content
    if "refund" in message.lower():
        refund_policy = next((p for p in matched_policies if p["source"] == "policy_refunds"), None)
        if refund_policy:
            response_text += refund_policy["content"] + " "
        else:
            response_text += "Based on stadium refund rules, refunds must be logged within 15 minutes of checkout. "
            
    if "limit" in message.lower() or "warning" in message.lower() or "stock" in message.lower():
        inventory_policy = next((p for p in matched_policies if p["source"] == "policy_inventory"), None)
        if inventory_policy:
            response_text += inventory_policy["content"] + " "
            
    if "surge" in message.lower() or "pricing" in message.lower() or "cooldown" in message.lower():
        pricing_policy = next((p for p in matched_policies if p["source"] == "policy_pricing"), None)
        if pricing_policy:
            response_text += pricing_policy["content"] + " "

    if item_context:
        response_text += "From your live catalog: " + " ".join(item_context) + " "

    # Fallback default general response
    if not response_text:
        response_text = (
            "Hello, I am your Stadium Operations Assistant. I can help you query concession inventories, "
            "review stadium refund policies, or inspect dynamic pricing factors."
        )

    return response_text.strip(), sources


@router.post(
    "/",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate a chat prompt and return RAG context grounded answers"
)
def chat_endpoint(
    request_data: ChatRequest,
    db: Session = Depends(get_db)
):
    response, sources = generate_local_response(request_data.message, request_data.role, db)
    
    # Save to session memory
    session_id = request_data.session_id or "default"
    if session_id not in sessions_memory:
        sessions_memory[session_id] = []
    
    sessions_memory[session_id].append({"role": "user", "content": request_data.message})
    sessions_memory[session_id].append({"role": "assistant", "content": response})

    return ChatResponse(response=response, sources=sources)


@router.get(
    "/stream",
    summary="Stream AI Copilot RAG response token-by-token using Server-Sent Events (SSE)"
)
async def chat_stream_endpoint(
    message: str = Query(..., min_length=1),
    session_id: Optional[str] = Query(None),
    role: str = Query("vendor"),
    db: Session = Depends(get_db)
):
    async def sse_event_generator():
        # Get dynamic response content and sources
        response, sources = generate_local_response(message, role, db)

        # 1. Update memory history cache
        sid = session_id or "default"
        if sid not in sessions_memory:
            sessions_memory[sid] = []
        sessions_memory[sid].append({"role": "user", "content": message})
        sessions_memory[sid].append({"role": "assistant", "content": response})

        # 2. Stream tokens word by word to emulate natural model generations
        words = response.split(" ")
        for i, word in enumerate(words):
            token = word + (" " if i < len(words) - 1 else "")
            payload = {
                "token": token,
                "done": False,
                "sources": []
            }
            yield f"data: {json.dumps(payload)}\n\n"
            # Slight delay to mimic streaming output
            await asyncio.sleep(0.03)

        # 3. Final event payload containing the matched source attribution cards
        final_payload = {
            "token": "",
            "done": True,
            "sources": sources
        }
        yield f"data: {json.dumps(final_payload)}\n\n"

    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")

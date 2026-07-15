from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# Chat schemas
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User question or input command to the AI Copilot")
    session_id: Optional[str] = Field(None, description="Persisted chat session identifier for conversation memory context")
    role: str = Field("vendor", description="Contextual role of user: vendor, staff, security, fan")

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]] = []

    model_config = {
        "from_attributes": True
    }

import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

ALLOWED_TYPES = ["fire", "medical", "security", "structural", "general"]
ALLOWED_SEVERITY_LEVELS = ["info", "low", "medium", "high", "critical"]

# Incident schemas
class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    type: str = Field(..., description="Incident type: fire, medical, security, structural, or general")
    area_id: int

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v.lower() not in ALLOWED_TYPES:
            raise ValueError(f"Type must be one of: {', '.join(ALLOWED_TYPES)}")
        return v.lower()

class IncidentOverride(BaseModel):
    severity_level: str = Field(..., description="Manually overridden severity level: info, low, medium, high, critical")

    @field_validator("severity_level")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        if v.lower() not in ALLOWED_SEVERITY_LEVELS:
            raise ValueError(f"Severity level must be one of: {', '.join(ALLOWED_SEVERITY_LEVELS)}")
        return v.lower()

class IncidentResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    type: str
    area_id: int
    severity_score: float
    severity_level: str
    status: str
    is_overridden: bool
    created_at: datetime.datetime

    model_config = {
        "from_attributes": True
    }

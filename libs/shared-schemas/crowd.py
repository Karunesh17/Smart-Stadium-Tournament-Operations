import datetime
from typing import List
from pydantic import BaseModel, Field

# Area schemas
class AreaCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Area sector name")
    capacity: int = Field(..., gt=0, description="Safe maximum occupancy limit")

class AreaResponse(BaseModel):
    id: int
    name: str
    capacity: int

    model_config = {
        "from_attributes": True
    }

# Telemetry ingestion schemas
class TelemetryIngest(BaseModel):
    area_id: int
    count: int = Field(..., ge=0, description="Aggregated occupancy headcount count must be non-negative")

class CrowdDataResponse(BaseModel):
    id: int
    area_id: int
    count: int
    timestamp: datetime.datetime

    model_config = {
        "from_attributes": True
    }

# Heatmap analysis schemas
class HeatmapArea(BaseModel):
    area_id: int
    name: str
    capacity: int
    current_count: int
    density_percentage: float = Field(..., description="Calculated density ratio as a percentage")
    status: str = Field(..., description="Computed zone status: safe, warning, or danger")

class HeatmapResponse(BaseModel):
    areas: List[HeatmapArea]
    updated_at: datetime.datetime

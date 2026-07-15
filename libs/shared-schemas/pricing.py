import datetime
from pydantic import BaseModel, Field

# Forecast schemas
class ForecastRequest(BaseModel):
    item_id: int
    projected_sales_quantity: int = Field(..., ge=1, description="Number of items projected to sell in next interval")

class ForecastResponse(BaseModel):
    projected_price: float
    confidence_basis: str
    confidence_score: float

# Price history schemas
class PriceHistoryResponse(BaseModel):
    id: int
    item_id: int
    old_price: float
    new_price: float
    reason: str
    timestamp: datetime.datetime

    model_config = {
        "from_attributes": True
    }

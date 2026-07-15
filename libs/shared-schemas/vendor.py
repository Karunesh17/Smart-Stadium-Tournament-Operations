import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

# Vendor schemas
class VendorCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Vendor profile name")
    type: str = Field(..., min_length=2, max_length=50, description="Type of concession, e.g. Food, Merch")

class VendorResponse(BaseModel):
    id: int
    name: str
    type: str
    rating: Optional[float] = None
    owner_user_id: int

    model_config = {
        "from_attributes": True
    }

# Item schemas
class ItemCreate(BaseModel):
    vendor_id: int
    name: str = Field(..., min_length=1, max_length=100)
    base_price: float = Field(..., gt=0.0)
    stock: int = Field(..., ge=0)

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    base_price: Optional[float] = Field(None, gt=0.0)
    stock: Optional[int] = Field(None, ge=0)

class ItemResponse(BaseModel):
    id: int
    vendor_id: int
    name: str
    base_price: float
    original_price: Optional[float] = None
    stock: int
    updated_at: datetime.datetime

    model_config = {
        "from_attributes": True
    }


# Sale schemas
class SaleCreate(BaseModel):
    item_id: int
    quantity: int = Field(..., gt=0, description="Quantity sold must be positive")

class SaleResponse(BaseModel):
    id: int
    item_id: int
    quantity: int
    price_at_sale: float
    timestamp: datetime.datetime

    model_config = {
        "from_attributes": True
    }

import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

# Staff schemas
class StaffCreate(BaseModel):
    user_id: int
    role_specialty: str = Field(..., min_length=2, max_length=50, description="Specialty role, e.g. Security, Medical, Concession")

class StaffResponse(BaseModel):
    id: int
    user_id: int
    role_specialty: str

    model_config = {
        "from_attributes": True
    }

# Shift schemas
class ShiftCreate(BaseModel):
    staff_id: int
    start_time: datetime.datetime
    end_time: datetime.datetime
    zone: str = Field(..., min_length=2, max_length=100)

    @field_validator("end_time")
    @classmethod
    def check_times(cls, v: datetime.datetime, info):
        if "start_time" in info.data and v <= info.data["start_time"]:
            raise ValueError("end_time must be after start_time")
        return v

class ShiftResponse(BaseModel):
    id: int
    staff_id: int
    start_time: datetime.datetime
    end_time: datetime.datetime
    zone: str

    model_config = {
        "from_attributes": True
    }

# Task schemas
class TaskCreate(BaseModel):
    assigned_staff_id: Optional[int] = None
    title: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None

class TaskUpdate(BaseModel):
    status: str = Field(..., description="Task status: open, in-progress, or done")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = ["open", "in-progress", "done"]
        if v not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(allowed)}")
        return v

class TaskResponse(BaseModel):
    id: int
    assigned_staff_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    status: str
    created_at: datetime.datetime

    model_config = {
        "from_attributes": True
    }

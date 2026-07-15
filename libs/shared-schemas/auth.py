import datetime
import re
from typing import Literal
from pydantic import BaseModel, Field, field_validator

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name of the user")
    email: str = Field(..., description="Unique email address")
    password: str = Field(..., min_length=8, description="Password with minimum 8 characters")
    role: Literal["fan", "staff", "vendor", "security", "admin"] = Field(..., description="Assigned role")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: str) -> str:
        email_regex = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(email_regex, value):
            raise ValueError("Invalid email format")
        return value.lower()

class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: str) -> str:
        return value.lower()

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime.datetime

    model_config = {
        "from_attributes": True
    }

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

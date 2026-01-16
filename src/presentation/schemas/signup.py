"""
Signup Schemas
"""

from typing import ClassVar, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    """Request schema for user signup."""

    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    first_name: str = Field(..., min_length=1, max_length=255)
    last_name: str = Field(..., min_length=1, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=50)
    terms_accepted: bool = Field(False, description="User must accept terms and conditions")

    class Config:
        json_schema_extra: ClassVar[dict] = {
            "example": {
                "email": "user@example.com",
                "password": "securepassword123",
                "first_name": "John",
                "last_name": "Doe",
                "phone_number": "1234567890",
                "terms_accepted": True,
            }
        }


class SignupResponse(BaseModel):
    """Response schema for user signup."""

    user_id: UUID
    email: EmailStr
    first_name: str
    last_name: str

    class Config:
        json_schema_extra: ClassVar[dict] = {
            "example": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "first_name": "John",
                "last_name": "Doe",
            }
        }

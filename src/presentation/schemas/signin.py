"""
Signin Schemas
"""

from uuid import UUID

from pydantic import BaseModel, EmailStr


class SigninRequest(BaseModel):
    """Request schema for user signin."""

    email: EmailStr
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "securepassword123",
            }
        }


class SigninResponse(BaseModel):
    """Response schema for user signin."""

    user_id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    is_active: bool

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "is_active": True,
            }
        }

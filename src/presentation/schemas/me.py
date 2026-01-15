"""
Me Query Schemas
"""

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RoleResponse(BaseModel):
    """Role information in user response."""

    id: UUID
    name: str

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "admin_global",
            }
        }


class AddressResponse(BaseModel):
    """Address information in user response."""

    line: str
    postal_code: str
    city: str
    country: str
    complement: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "line": "123 Main St",
                "postal_code": "12345",
                "city": "Anytown",
                "country": "USA",
                "complement": "Apt 4B",
            }
        }


class MeResponse(BaseModel):
    """Response schema for GET /me."""

    user_id: UUID
    email: str
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    address: Optional[AddressResponse] = None
    avatar_url: Optional[str] = None
    is_active: bool
    terms_accepted: bool
    roles: List[RoleResponse] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "phone_number": "1234567890",
                "address": {
                    "line": "123 Main St",
                    "postal_code": "12345",
                    "city": "Anytown",
                    "country": "USA",
                },
                "avatar_url": "https://example.com/avatar.jpg",
                "is_active": True,
                "terms_accepted": True,
                "roles": [{"id": "123e4567-e89b-12d3-a456-426614174000", "name": "admin_global"}],
            }
        }

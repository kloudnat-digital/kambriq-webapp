"""
Me Query DTOs
"""

from dataclasses import dataclass
from typing import List, Optional
from uuid import UUID

from src.domain.entities.user_address import UserAddress


@dataclass
class RoleResponse:
    """Role information in user response."""

    id: UUID
    name: str


@dataclass
class MeResponse:
    """Response DTO for GET /me."""

    user_id: UUID
    email: str
    first_name: str
    last_name: str
    phone_number: Optional[str]
    address: Optional[UserAddress]
    avatar_url: Optional[str]
    is_active: bool
    terms_accepted: bool
    roles: List[RoleResponse]

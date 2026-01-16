"""
Signin DTOs
"""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class SigninRequest:
    """Request DTO for user signin."""

    email: str
    password: str


@dataclass
class SigninResponse:
    """Response DTO for user signin."""

    user_id: UUID
    email: str
    first_name: str
    last_name: str
    is_active: bool

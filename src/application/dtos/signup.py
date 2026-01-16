"""
Signup DTOs
"""

from dataclasses import dataclass
from typing import Optional
from uuid import UUID


@dataclass
class SignupRequest:
    """Request DTO for user signup."""

    email: str
    password: str
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    terms_accepted: bool = False


@dataclass
class SignupResponse:
    """Response DTO for user signup."""

    user_id: UUID
    email: str
    first_name: str
    last_name: str

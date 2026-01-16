"""
Reset Password DTOs
"""

from dataclasses import dataclass


@dataclass
class ResetPasswordRequestRequest:
    """Request DTO for password reset request."""

    email: str


@dataclass
class ResetPasswordConfirmRequest:
    """Request DTO for password reset confirmation."""

    token: str
    new_password: str

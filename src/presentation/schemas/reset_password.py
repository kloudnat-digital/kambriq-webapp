"""
Reset Password Schemas
"""

from pydantic import BaseModel, EmailStr, Field


class ResetPasswordRequestRequest(BaseModel):
    """Request schema for password reset request."""

    email: EmailStr

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
            }
        }


class ResetPasswordConfirmRequest(BaseModel):
    """Request schema for password reset confirmation."""

    token: str = Field(..., description="Password reset token")
    new_password: str = Field(
        ..., min_length=8, description="New password must be at least 8 characters"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "token": "reset_token_here",
                "new_password": "newsecurepassword123",
            }
        }

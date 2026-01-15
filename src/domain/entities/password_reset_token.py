"""
PasswordResetToken Entity

Represents a password reset token.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4


@dataclass
class PasswordResetToken:
    """
    Domain entity representing a password reset token.

    The token itself is stored as a hash in the database (never plaintext).

    Attributes:
        id: Unique identifier
        user_id: User ID who requested the reset
        token_hash: Hashed token (SHA-256 or HMAC-SHA256)
        expires_at: When the token expires
        used_at: When the token was used (None if unused)
        created_at: Creation timestamp
        created_by_ip: IP address from which token was created
    """

    id: UUID
    user_id: UUID
    token_hash: str
    expires_at: datetime
    used_at: Optional[datetime]
    created_at: datetime
    created_by_ip: Optional[str]

    def __post_init__(self) -> None:
        """Validate password reset token fields."""
        if not self.token_hash or not self.token_hash.strip():
            raise ValueError("Token hash cannot be empty")
        if self.expires_at <= self.created_at:
            raise ValueError("Expires at must be after created at")

    @classmethod
    def create(
        cls,
        user_id: UUID,
        token_hash: str,
        expires_in_hours: int = 24,
        created_by_ip: Optional[str] = None,
    ) -> "PasswordResetToken":
        """
        Factory method to create a new PasswordResetToken.

        Args:
            user_id: User ID
            token_hash: Hashed token
            expires_in_hours: Hours until expiration (default: 24)
            created_by_ip: IP address

        Returns:
            New PasswordResetToken instance
        """
        now = datetime.utcnow()
        return cls(
            id=uuid4(),
            user_id=user_id,
            token_hash=token_hash,
            expires_at=now + timedelta(hours=expires_in_hours),
            used_at=None,
            created_at=now,
            created_by_ip=created_by_ip,
        )

    def mark_as_used(self) -> None:
        """Mark the token as used."""
        if self.is_used:
            raise ValueError("Token is already used")

        self.used_at = datetime.utcnow()

    @property
    def is_used(self) -> bool:
        """Check if token has been used."""
        return self.used_at is not None

    @property
    def is_expired(self) -> bool:
        """Check if token is expired."""
        return datetime.utcnow() >= self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if token is valid (not used and not expired)."""
        return not self.is_used and not self.is_expired

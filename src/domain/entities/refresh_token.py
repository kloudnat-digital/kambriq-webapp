"""
RefreshToken Entity

Represents a refresh token for user authentication.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4


@dataclass
class RefreshToken:
    """
    Domain entity representing a refresh token.

    The token itself is stored as a hash in the database (never plaintext).

    Attributes:
        id: Unique identifier
        user_id: User ID who owns this token
        token_hash: Hashed token (SHA-256 or HMAC-SHA256)
        jti: JWT ID (unique identifier for the token)
        issued_at: When the token was issued
        expires_at: When the token expires
        revoked_at: When the token was revoked (None if still active)
        replaced_by_token_id: ID of token that replaced this one (for rotation)
        created_by_ip: IP address from which token was created
        user_agent: User agent string from request
    """

    id: UUID
    user_id: UUID
    token_hash: str
    jti: str
    issued_at: datetime
    expires_at: datetime
    revoked_at: Optional[datetime]
    replaced_by_token_id: Optional[UUID]
    created_by_ip: Optional[str]
    user_agent: Optional[str]

    def __post_init__(self) -> None:
        """Validate refresh token fields."""
        if not self.token_hash or not self.token_hash.strip():
            raise ValueError("Token hash cannot be empty")
        if not self.jti or not self.jti.strip():
            raise ValueError("JTI cannot be empty")
        if self.expires_at <= self.issued_at:
            raise ValueError("Expires at must be after issued at")

    @classmethod
    def create(
        cls,
        user_id: UUID,
        token_hash: str,
        jti: str,
        expires_in_days: int = 7,
        created_by_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> "RefreshToken":
        """
        Factory method to create a new RefreshToken.

        Args:
            user_id: User ID
            token_hash: Hashed token
            jti: JWT ID (unique)
            expires_in_days: Days until expiration (default: 7)
            created_by_ip: IP address
            user_agent: User agent string

        Returns:
            New RefreshToken instance
        """
        now = datetime.utcnow()
        return cls(
            id=uuid4(),
            user_id=user_id,
            token_hash=token_hash,
            jti=jti,
            issued_at=now,
            expires_at=now + timedelta(days=expires_in_days),
            revoked_at=None,
            replaced_by_token_id=None,
            created_by_ip=created_by_ip,
            user_agent=user_agent,
        )

    def revoke(self, replaced_by_token_id: Optional[UUID] = None) -> None:
        """
        Revoke the refresh token.

        Args:
            replaced_by_token_id: Optional ID of token that replaces this one
        """
        if self.is_revoked:
            raise ValueError("Token is already revoked")

        self.revoked_at = datetime.utcnow()
        self.replaced_by_token_id = replaced_by_token_id

    @property
    def is_revoked(self) -> bool:
        """Check if token is revoked."""
        return self.revoked_at is not None

    @property
    def is_expired(self) -> bool:
        """Check if token is expired."""
        return datetime.utcnow() >= self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if token is valid (not revoked and not expired)."""
        return not self.is_revoked and not self.is_expired

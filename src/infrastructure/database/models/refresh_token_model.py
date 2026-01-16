"""
RefreshToken SQLAlchemy Model

Database model for RefreshToken entity.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from ..base import Base


class RefreshTokenModel(Base):
    """
    SQLAlchemy model for RefreshToken.

    Table: refresh_tokens

    The token is stored as a hash, never in plaintext.
    """

    __tablename__ = "refresh_tokens"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash = Column(String(255), nullable=False, index=True)
    jti = Column(String(255), nullable=False, unique=True, index=True)  # JWT ID (unique)
    issued_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    replaced_by_token_id = Column(
        PG_UUID(as_uuid=True), ForeignKey("refresh_tokens.id", ondelete="SET NULL"), nullable=True
    )
    created_by_ip = Column(String(45), nullable=True)  # IPv6 max length
    user_agent = Column(String(500), nullable=True)

    # Index for finding active tokens
    __table_args__ = (
        Index("ix_refresh_tokens_user_active", "user_id", "revoked_at", "expires_at"),
    )

    # Relationships
    user = relationship("UserModel", back_populates="refresh_tokens")
    replaced_by = relationship(
        "RefreshTokenModel", remote_side=[id], foreign_keys=[replaced_by_token_id]
    )

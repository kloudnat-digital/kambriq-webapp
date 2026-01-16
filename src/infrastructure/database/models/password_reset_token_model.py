"""
PasswordResetToken SQLAlchemy Model

Database model for PasswordResetToken entity.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from ..base import Base


class PasswordResetTokenModel(Base):
    """
    SQLAlchemy model for PasswordResetToken.

    Table: password_reset_tokens

    The token is stored as a hash, never in plaintext.
    """

    __tablename__ = "password_reset_tokens"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    created_by_ip = Column(String(45), nullable=True)  # IPv6 max length

    # Index for finding active tokens
    __table_args__ = (Index("ix_password_reset_tokens_active", "user_id", "used_at", "expires_at"),)

    # Relationships
    user = relationship("UserModel", back_populates="password_reset_tokens")

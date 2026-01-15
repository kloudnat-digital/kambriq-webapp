"""
Role SQLAlchemy Model

Database model for Role entity.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from ..base import Base


class RoleModel(Base):
    """
    SQLAlchemy model for Role.

    Table: roles
    """

    __tablename__ = "roles"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user_roles = relationship("UserRoleModel", back_populates="role", cascade="all, delete-orphan")
    permissions = relationship(
        "PermissionModel", back_populates="role", cascade="all, delete-orphan"
    )

"""
UserRole SQLAlchemy Model

Association table for many-to-many relationship between User and Role.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from ..base import Base


class UserRoleModel(Base):
    """
    SQLAlchemy model for User-Role association.
    
    Table: user_roles
    """
    
    __tablename__ = "user_roles"
    
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(PG_UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    assigned_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Unique constraint: one role per user (no duplicates)
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_user_roles_user_role"),
    )
    
    # Relationships
    user = relationship("UserModel", foreign_keys=[user_id], back_populates="roles")
    role = relationship("RoleModel", back_populates="user_roles")
    assigned_by_user = relationship("UserModel", foreign_keys=[assigned_by])


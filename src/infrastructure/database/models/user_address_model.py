"""
UserAddress SQLAlchemy Model

Database model for UserAddress value object.
"""

from uuid import uuid4

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from ..base import Base


class UserAddressModel(Base):
    """
    SQLAlchemy model for UserAddress.

    Table: user_addresses
    """

    __tablename__ = "user_addresses"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    line = Column(String(500), nullable=False)
    complement = Column(String(500), nullable=True)
    postal_code = Column(String(50), nullable=False)
    city = Column(String(255), nullable=False)
    country = Column(String(255), nullable=False)

    # Relationship
    user = relationship("UserModel", back_populates="address")

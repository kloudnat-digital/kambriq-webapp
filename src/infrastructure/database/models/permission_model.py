"""
Permission SQLAlchemy Model (Matrice Format)

Database model for PermissionMatrix entity.
Each row represents permissions for a (role_id, resource_id) combination.
Contains 36 boolean columns for all actions.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from ..base import Base


class PermissionModel(Base):
    """
    SQLAlchemy model for PermissionMatrix (matrice format).
    
    Table: permissions
    
    Format matrice:
    - 1 ligne = (role_id, resource_id)
    - 36 colonnes bool pour les actions
    - UNIQUE(role_id, resource_id)
    """
    
    __tablename__ = "permissions"
    
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    role_id = Column(PG_UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    resource_id = Column(PG_UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    
    # LAND actions (7)
    land_view_public_lands = Column(Boolean, nullable=False, default=False)
    land_view_agents_catalog = Column(Boolean, nullable=False, default=False)
    land_view_agent_land_detail = Column(Boolean, nullable=False, default=False)
    land_upsert_land = Column(Boolean, nullable=False, default=False)
    land_assign_label_tdt_vefil_vefl = Column(Boolean, nullable=False, default=False)
    land_reserve_land = Column(Boolean, nullable=False, default=False)
    land_validate_reservation = Column(Boolean, nullable=False, default=False)
    
    # VERIFY actions (5)
    verify_submit_case = Column(Boolean, nullable=False, default=False)
    verify_view_own_results = Column(Boolean, nullable=False, default=False)
    verify_process_request = Column(Boolean, nullable=False, default=False)
    verify_generate_documents = Column(Boolean, nullable=False, default=False)
    verify_rate_case_compliant = Column(Boolean, nullable=False, default=False)
    
    # KBS actions (7)
    kbs_view_kbs_presentation = Column(Boolean, nullable=False, default=False)
    kbs_signup = Column(Boolean, nullable=False, default=False)
    kbs_access_courses = Column(Boolean, nullable=False, default=False)
    kbs_take_exam = Column(Boolean, nullable=False, default=False)
    kbs_view_kca_certificate = Column(Boolean, nullable=False, default=False)
    kbs_manage_contents = Column(Boolean, nullable=False, default=False)
    kbs_manage_candidates = Column(Boolean, nullable=False, default=False)
    
    # KAMNET actions (7)
    kamnet_view_land_catalog = Column(Boolean, nullable=False, default=False)
    kamnet_reserve_land = Column(Boolean, nullable=False, default=False)
    kamnet_view_referrals_n1 = Column(Boolean, nullable=False, default=False)
    kamnet_view_referrals_n1_n2_n3 = Column(Boolean, nullable=False, default=False)
    kamnet_view_personal_network = Column(Boolean, nullable=False, default=False)
    kamnet_manage_agents = Column(Boolean, nullable=False, default=False)
    kamnet_create_agent = Column(Boolean, nullable=False, default=False)
    
    # PARTNER actions (5)
    partner_create = Column(Boolean, nullable=False, default=False)
    partner_read = Column(Boolean, nullable=False, default=False)
    partner_update = Column(Boolean, nullable=False, default=False)
    partner_delete = Column(Boolean, nullable=False, default=False)
    partner_export = Column(Boolean, nullable=False, default=False)
    
    # ADMINISTRATEUR actions (5)
    administrateur_create = Column(Boolean, nullable=False, default=False)
    administrateur_read = Column(Boolean, nullable=False, default=False)
    administrateur_update = Column(Boolean, nullable=False, default=False)
    administrateur_delete = Column(Boolean, nullable=False, default=False)
    administrateur_export = Column(Boolean, nullable=False, default=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Unique constraint: one row per (role_id, resource_id)
    __table_args__ = (
        UniqueConstraint("role_id", "resource_id", name="uq_permissions_role_resource"),
    )
    
    # Relationships
    role = relationship("RoleModel", back_populates="permissions")
    resource = relationship("ResourceModel", back_populates="permissions")


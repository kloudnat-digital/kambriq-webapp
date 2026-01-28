"""
Permission Matrix Repository Implementation

SQLAlchemy implementation for PermissionMatrix repository.
"""

from typing import List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.entities.permission_matrix import PermissionMatrix
from src.infrastructure.database.models.permission_model import PermissionModel


class PermissionMatrixRepository:
    """SQLAlchemy implementation for PermissionMatrix repository."""

    def __init__(self, session: AsyncSession):
        """
        Initialize permission matrix repository.

        Args:
            session: Async SQLAlchemy session
        """
        self.session = session

    async def find_all(self) -> List[Tuple[PermissionMatrix, str, str]]:
        """
        Find all permission matrix entries with roles and resources loaded.

        Returns:
            List of tuples (PermissionMatrix entity, role_name, resource_name)
        """
        stmt = (
            select(PermissionModel)
            .options(
                selectinload(PermissionModel.role),
                selectinload(PermissionModel.resource),
            )
            .order_by(PermissionModel.role_id, PermissionModel.resource_id)
        )
        result = await self.session.execute(stmt)
        permission_models = result.scalars().all()

        return [self._to_entity(pm) for pm in permission_models]

    def _to_entity(
        self, permission_model: PermissionModel, role_name: str = "", resource_name: str = ""
    ) -> Tuple[PermissionMatrix, str, str]:
        """
        Convert PermissionModel to PermissionMatrix entity with role and resource names.

        Args:
            permission_model: SQLAlchemy model instance
            role_name: Role name (from loaded relationship)
            resource_name: Resource name (from loaded relationship)

        Returns:
            Tuple of (PermissionMatrix entity, role_name, resource_name)
        """
        # Get role and resource names from loaded relationships
        if not role_name and permission_model.role:
            role_name = permission_model.role.name
        if not resource_name and permission_model.resource:
            resource_name = permission_model.resource.name

        # Get all action fields from the model
        action_fields = [
            "land_view_public_lands",
            "land_view_agents_catalog",
            "land_view_agent_land_detail",
            "land_upsert_land",
            "land_assign_label_tdt_vefil_vefl",
            "land_reserve_land",
            "land_validate_reservation",
            "verify_submit_case",
            "verify_view_own_results",
            "verify_process_request",
            "verify_generate_documents",
            "verify_rate_case_compliant",
            "kbs_view_kbs_presentation",
            "kbs_signup",
            "kbs_access_courses",
            "kbs_take_exam",
            "kbs_view_kca_certificate",
            "kbs_manage_contents",
            "kbs_manage_candidates",
            "kamnet_view_land_catalog",
            "kamnet_reserve_land",
            "kamnet_view_referrals_n1",
            "kamnet_view_referrals_n1_n2_n3",
            "kamnet_view_personal_network",
            "kamnet_manage_agents",
            "kamnet_create_agent",
            "partner_create",
            "partner_read",
            "partner_update",
            "partner_delete",
            "partner_export",
            "administrateur_create",
            "administrateur_read",
            "administrateur_update",
            "administrateur_delete",
            "administrateur_export",
        ]

        # Build kwargs for PermissionMatrix.create
        action_kwargs = {field: getattr(permission_model, field, False) for field in action_fields}

        permission_matrix = PermissionMatrix.create(
            role_id=permission_model.role_id,
            resource_id=permission_model.resource_id,
            **action_kwargs,
        )

        return (permission_matrix, role_name, resource_name)

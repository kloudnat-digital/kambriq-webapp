"""
Get Permission Matrix Use Case

Handles GET /permissions/matrix endpoint to retrieve the complete permission matrix.
"""

from typing import TYPE_CHECKING

from src.application.dtos.permission_matrix import (
    ActionPermissionResponse,
    PermissionMatrixResponse,
    ResourcePermissionResponse,
    RolePermissionResponse,
)
from src.infrastructure.repositories.permission_matrix_repository import (
    PermissionMatrixRepository,
)

if TYPE_CHECKING:
    from src.domain.entities.permission_matrix import PermissionMatrix


class GetPermissionMatrixUseCase:
    """Use case for retrieving the complete permission matrix."""

    def __init__(self, permission_matrix_repository: PermissionMatrixRepository):
        """
        Initialize get permission matrix use case.

        Args:
            permission_matrix_repository: Permission matrix repository
        """
        self.permission_matrix_repository = permission_matrix_repository

    async def execute(self) -> PermissionMatrixResponse:
        """
        Execute get permission matrix use case.

        Returns:
            Permission matrix response DTO
        """
        # Get all permission matrix entries with role and resource names
        permissions_data = await self.permission_matrix_repository.find_all()

        # Group by role, then by resource
        role_permissions: dict[str, dict[str, tuple["PermissionMatrix", str, str]]] = {}
        role_names: dict[str, str] = {}

        for perm, role_name, resource_name in permissions_data:
            role_id_str = str(perm.role_id)
            resource_id_str = str(perm.resource_id)

            # Store role name
            if role_id_str not in role_names:
                role_names[role_id_str] = role_name

            # Group by role and resource
            if role_id_str not in role_permissions:
                role_permissions[role_id_str] = {}

            # Store permission with resource name
            role_permissions[role_id_str][resource_id_str] = (perm, role_name, resource_name)

        # Build response structure
        roles_response = []
        for role_id_str, resources_dict in role_permissions.items():
            resources_response = []
            for perm, _role_name, resource_name in resources_dict.values():
                # Get all actions from the permission matrix
                actions = []
                for action_name in perm.all_actions:
                    if hasattr(perm, action_name):
                        actions.append(
                            ActionPermissionResponse(
                                action=action_name,
                                allowed=getattr(perm, action_name, False),
                            )
                        )

                resources_response.append(
                    ResourcePermissionResponse(
                        resource_id=perm.resource_id,
                        resource_name=resource_name,
                        actions=actions,
                    )
                )

            # Get role name
            role_name = role_names.get(role_id_str, "")
            if not role_name and resources_dict:
                # Get from first resource entry
                _, role_name, _ = next(iter(resources_dict.values()))

            roles_response.append(
                RolePermissionResponse(
                    role_id=perm.role_id,
                    role_name=role_name,
                    resources=resources_response,
                )
            )

        return PermissionMatrixResponse(roles=roles_response)

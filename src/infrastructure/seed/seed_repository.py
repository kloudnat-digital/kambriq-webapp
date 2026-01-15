"""
Seed Repository

Repository for idempotent seeding operations.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.domain.entities.permission_matrix import PermissionMatrix
from src.domain.entities.role import Role
from src.domain.entities.resource import Resource
from src.domain.entities.user import User
from src.infrastructure.database.models.role_model import RoleModel
from src.infrastructure.database.models.resource_model import ResourceModel
from src.infrastructure.database.models.permission_model import PermissionModel
from src.infrastructure.database.models.user_model import UserModel
from src.infrastructure.database.models.user_role_model import UserRoleModel

from .seed_data import RESOURCE_ACTIONS


class SeedRepository:
    """Repository for idempotent seeding operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def upsert_role(self, name: str) -> RoleModel:
        """
        Create or update a role (idempotent).

        Args:
            name: Role name

        Returns:
            RoleModel instance
        """
        # Check if role exists
        result = await self.session.scalar(
            select(RoleModel).where(RoleModel.name == name)
        )

        if result:
            return result

        # Create new role
        role = RoleModel(name=name)
        self.session.add(role)
        await self.session.flush()
        return role

    async def upsert_resource(self, name: str) -> ResourceModel:
        """
        Create or update a resource (idempotent).

        Args:
            name: Resource name

        Returns:
            ResourceModel instance
        """
        # Check if resource exists
        result = await self.session.scalar(
            select(ResourceModel).where(ResourceModel.name == name)
        )

        if result:
            return result

        # Create new resource
        resource = ResourceModel(name=name)
        self.session.add(resource)
        await self.session.flush()
        return resource

    async def upsert_permission(
        self, role_id: UUID, resource_id: UUID, action_permissions: dict[str, bool]
    ) -> PermissionModel:
        """
        Create or update a permission matrix entry (idempotent).

        Args:
            role_id: Role ID
            resource_id: Resource ID
            action_permissions: Dict of action -> bool (permissions to set)

        Returns:
            PermissionModel instance
        """
        # Check if permission exists
        result = await self.session.scalar(
            select(PermissionModel).where(
                PermissionModel.role_id == role_id,
                PermissionModel.resource_id == resource_id,
            )
        )

        if result:
            # Update existing permissions
            for action, value in action_permissions.items():
                if hasattr(result, action):
                    setattr(result, action, value)
            await self.session.flush()
            return result

        # Create new permission
        permission = PermissionModel(
            role_id=role_id,
            resource_id=resource_id,
            **action_permissions,
        )
        self.session.add(permission)
        await self.session.flush()
        return permission

    async def upsert_user(
        self,
        email: str,
        first_name: str,
        last_name: str,
        password_hash: str,
        phone_number: Optional[str] = None,
        is_active: bool = True,
        terms_accepted: bool = True,
    ) -> UserModel:
        """
        Create or update a user (idempotent).

        Args:
            email: User email
            first_name: First name
            last_name: Last name
            password_hash: Hashed password
            phone_number: Phone number (optional)
            is_active: Is active flag
            terms_accepted: Terms accepted flag

        Returns:
            UserModel instance
        """
        # Check if user exists
        result = await self.session.scalar(
            select(UserModel).where(UserModel.email == email)
        )

        if result:
            # Update existing user
            result.first_name = first_name
            result.last_name = last_name
            result.password_hash = password_hash
            if phone_number:
                result.phone_number = phone_number
            result.is_active = is_active
            result.terms_accepted = terms_accepted
            await self.session.flush()
            return result

        # Create new user
        user = UserModel(
            email=email,
            first_name=first_name,
            last_name=last_name,
            password_hash=password_hash,
            phone_number=phone_number,
            is_active=is_active,
            terms_accepted=terms_accepted,
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def upsert_user_role(self, user_id: UUID, role_id: UUID) -> UserRoleModel:
        """
        Create or update user-role association (idempotent).

        Args:
            user_id: User ID
            role_id: Role ID

        Returns:
            UserRoleModel instance
        """
        # Check if association exists
        result = await self.session.scalar(
            select(UserRoleModel).where(
                UserRoleModel.user_id == user_id,
                UserRoleModel.role_id == role_id,
            )
        )

        if result:
            return result

        # Create new association
        user_role = UserRoleModel(user_id=user_id, role_id=role_id)
        self.session.add(user_role)
        await self.session.flush()
        return user_role

    def get_resource_actions(self, resource_name: str) -> list[str]:
        """
        Get list of action names for a resource.

        Args:
            resource_name: Resource name

        Returns:
            List of action names
        """
        return RESOURCE_ACTIONS.get(resource_name, [])


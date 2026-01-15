"""
Role Repository Implementation

SQLAlchemy implementation of RoleRepository.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.role import Role
from src.domain.repositories.role_repository import RoleRepository as IRoleRepository
from src.infrastructure.database.models.role_model import RoleModel


class RoleRepositoryImpl(IRoleRepository):
    """SQLAlchemy implementation of RoleRepository."""

    def __init__(self, session: AsyncSession):
        """Initialize role repository."""
        self.session = session

    async def find_by_id(self, role_id: UUID) -> Optional[Role]:
        """Find role by ID."""
        stmt = select(RoleModel).where(RoleModel.id == role_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_name(self, name: str) -> Optional[Role]:
        """Find role by name."""
        stmt = select(RoleModel).where(RoleModel.name == name)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def save(self, role: Role) -> Role:
        """Save or update role."""
        stmt = select(RoleModel).where(RoleModel.id == role.id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()

        if model:
            model.name = role.name
            model.updated_at = role.updated_at
        else:
            model = RoleModel(
                id=role.id,
                name=role.name,
                created_at=role.created_at,
                updated_at=role.updated_at,
            )
            self.session.add(model)

        await self.session.flush()
        await self.session.refresh(model)
        return self._to_entity(model)

    async def exists_by_name(self, name: str) -> bool:
        """Check if role exists by name."""
        stmt = select(RoleModel).where(RoleModel.name == name)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    def _to_entity(self, model: RoleModel) -> Role:
        """Convert RoleModel to Role entity."""
        return Role(
            id=model.id,
            name=model.name,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

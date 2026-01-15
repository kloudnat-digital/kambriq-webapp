"""
Role Repository Interface

Abstract interface for role repository operations.
"""

from abc import ABC, abstractmethod
from typing import Optional
from uuid import UUID

from ..entities.role import Role


class RoleRepository(ABC):
    """Abstract interface for role repository."""

    @abstractmethod
    async def find_by_id(self, role_id: UUID) -> Optional[Role]:
        """
        Find role by ID.

        Args:
            role_id: Role ID

        Returns:
            Role if found, None otherwise
        """

    @abstractmethod
    async def find_by_name(self, name: str) -> Optional[Role]:
        """
        Find role by name.

        Args:
            name: Role name

        Returns:
            Role if found, None otherwise
        """

    @abstractmethod
    async def save(self, role: Role) -> Role:
        """
        Save or update a role.

        Args:
            role: Role entity to save

        Returns:
            Saved role entity
        """

    @abstractmethod
    async def exists_by_name(self, name: str) -> bool:
        """
        Check if a role exists with the given name.

        Args:
            name: Role name to check

        Returns:
            True if role exists, False otherwise
        """

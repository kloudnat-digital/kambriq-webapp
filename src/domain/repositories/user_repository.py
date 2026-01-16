"""
User Repository Interface

Abstract interface for user repository operations.
"""

from abc import ABC, abstractmethod
from typing import Optional
from uuid import UUID

from ..entities.user import User


class UserRepository(ABC):
    """Abstract interface for user repository."""

    @abstractmethod
    async def find_by_id(self, user_id: UUID) -> Optional[User]:
        """
        Find user by ID.

        Args:
            user_id: User ID

        Returns:
            User if found, None otherwise
        """

    @abstractmethod
    async def find_by_email(self, email: str) -> Optional[User]:
        """
        Find user by email.

        Args:
            email: User email

        Returns:
            User if found, None otherwise
        """

    @abstractmethod
    async def save(self, user: User) -> User:
        """
        Save or update a user.

        Args:
            user: User entity to save

        Returns:
            Saved user entity
        """

    @abstractmethod
    async def exists_by_email(self, email: str) -> bool:
        """
        Check if a user exists with the given email.

        Args:
            email: Email to check

        Returns:
            True if user exists, False otherwise
        """

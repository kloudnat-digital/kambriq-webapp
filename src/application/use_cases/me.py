"""
Me Query Use Case

Handles GET /me endpoint to retrieve current user information.
"""

from uuid import UUID

from src.application.dtos.me import MeResponse
from src.domain.exceptions.auth_exceptions import UserInactiveError
from src.domain.exceptions.user_exceptions import UserNotFoundError
from src.domain.repositories.user_repository import UserRepository


class MeQueryUseCase:
    """Use case for retrieving current user information."""

    def __init__(self, user_repository: UserRepository):
        """
        Initialize me query use case.

        Args:
            user_repository: User repository
        """
        self.user_repository = user_repository

    async def execute(self, user_id: UUID) -> MeResponse:
        """
        Execute me query use case.

        Args:
            user_id: User ID from JWT token

        Returns:
            Me response DTO

        Raises:
            UserNotFoundError: If user not found
            UserInactiveError: If user is inactive
        """
        # Find user by ID
        user = await self.user_repository.find_by_id(user_id)
        if not user:
            raise UserNotFoundError("User not found")

        # Check if user is active
        if not user.is_active:
            raise UserInactiveError("User account is inactive")

        # Map roles to response DTOs
        # Note: Roles will be loaded by repository if needed
        # For now, return empty list (roles will be loaded in infrastructure layer)
        roles = []

        return MeResponse(
            user_id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone_number=user.phone_number,
            address=user.address,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            terms_accepted=user.terms_accepted,
            roles=roles,
        )

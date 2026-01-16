"""
Logout Use Case

Handles user logout by revoking refresh tokens.
"""

from uuid import UUID

from src.domain.repositories.refresh_token_repository import RefreshTokenRepository
from src.infrastructure.security.token_hasher import TokenHasher


class LogoutUseCase:
    """Use case for user logout."""

    def __init__(
        self,
        refresh_token_repository: RefreshTokenRepository,
        token_hasher: TokenHasher,
    ):
        """
        Initialize logout use case.

        Args:
            refresh_token_repository: Refresh token repository
            token_hasher: Token hasher service
        """
        self.refresh_token_repository = refresh_token_repository
        self.token_hasher = token_hasher

    async def execute(
        self,
        refresh_token_plain: str,
    ) -> None:
        """
        Execute logout use case.

        Args:
            refresh_token_plain: Plain refresh token to revoke

        Raises:
            TokenInvalidError: If token is invalid
        """
        # Hash the token to find it in DB
        token_hash = self.token_hasher.hash_token(refresh_token_plain)

        # Find token by hash
        refresh_token = await self.refresh_token_repository.find_by_token_hash(token_hash)

        if not refresh_token:
            # Token not found - already revoked or invalid
            # Don't reveal if token exists or not (security)
            return

        # Revoke token
        if not refresh_token.is_revoked:
            refresh_token.revoke()
            await self.refresh_token_repository.save(refresh_token)

    async def execute_by_user_id(self, user_id: UUID) -> None:
        """
        Execute logout for all tokens of a user.

        Args:
            user_id: User ID to revoke all tokens for
        """
        await self.refresh_token_repository.revoke_all_for_user(user_id)

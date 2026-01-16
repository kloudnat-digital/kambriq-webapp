"""
Refresh Token Use Case

Handles token refresh to get a new access token.
"""

import secrets
from typing import Optional, Tuple

from src.domain.entities.refresh_token import RefreshToken
from src.domain.exceptions.auth_exceptions import (
    TokenExpiredError,
    TokenInvalidError,
)
from src.domain.repositories.refresh_token_repository import RefreshTokenRepository
from src.domain.repositories.user_repository import UserRepository
from src.infrastructure.security.jwt_service import JWTService
from src.infrastructure.security.token_hasher import TokenHasher


class RefreshTokenUseCase:
    """Use case for refreshing access token."""

    def __init__(
        self,
        user_repository: UserRepository,
        refresh_token_repository: RefreshTokenRepository,
        jwt_service: JWTService,
        token_hasher: TokenHasher,
        refresh_token_expires_in_days: int = 7,
    ):
        """
        Initialize refresh token use case.

        Args:
            user_repository: User repository
            refresh_token_repository: Refresh token repository
            jwt_service: JWT service
            token_hasher: Token hasher service
            refresh_token_expires_in_days: Days until refresh token expires (default: 7)
        """
        self.user_repository = user_repository
        self.refresh_token_repository = refresh_token_repository
        self.jwt_service = jwt_service
        self.token_hasher = token_hasher
        self.refresh_token_expires_in_days = refresh_token_expires_in_days

    async def execute(
        self,
        refresh_token_plain: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Execute refresh token use case.

        Args:
            refresh_token_plain: Plain refresh token
            client_ip: Client IP address (optional)
            user_agent: User agent string (optional)

        Returns:
            Tuple of (access_token, new_refresh_token_plain)

        Raises:
            TokenInvalidError: If token is invalid
            TokenExpiredError: If token is expired
        """
        # Hash the token to find it in DB
        token_hash = self.token_hasher.hash_token(refresh_token_plain)

        # Find token by hash
        refresh_token = await self.refresh_token_repository.find_by_token_hash(token_hash)

        if not refresh_token:
            raise TokenInvalidError("Invalid refresh token")

        # Check if token is revoked
        if refresh_token.is_revoked:
            raise TokenInvalidError("Refresh token has been revoked")

        # Check if token is expired
        if refresh_token.is_expired:
            raise TokenExpiredError("Refresh token has expired")

        # Find user
        user = await self.user_repository.find_by_id(refresh_token.user_id)
        if not user:
            raise TokenInvalidError("User not found for refresh token")

        # Check if user is active
        if not user.is_active:
            raise TokenInvalidError("User account is inactive")

        # Generate new access token
        access_token = self.jwt_service.generate_access_token(user.id)

        # Generate new refresh token (token rotation for security)
        new_refresh_token_plain, new_refresh_token_hash = self.token_hasher.generate_token()
        new_jti = secrets.token_urlsafe(32)

        new_refresh_token = RefreshToken.create(
            user_id=user.id,
            token_hash=new_refresh_token_hash,
            jti=new_jti,
            expires_in_days=self.refresh_token_expires_in_days,
            created_by_ip=client_ip,
            user_agent=user_agent,
        )

        # Revoke old token and link to new one
        refresh_token.revoke(replaced_by_token_id=new_refresh_token.id)

        # Save both tokens
        await self.refresh_token_repository.save(refresh_token)
        await self.refresh_token_repository.save(new_refresh_token)

        return access_token, new_refresh_token_plain

"""
Signin Use Case

Handles user authentication.
"""

import secrets
from typing import Tuple

from src.application.dtos.signin import SigninRequest, SigninResponse
from src.domain.entities.refresh_token import RefreshToken
from src.domain.exceptions.auth_exceptions import (
    InvalidCredentialsError,
    UserInactiveError,
)
from src.domain.repositories.refresh_token_repository import RefreshTokenRepository
from src.domain.repositories.user_repository import UserRepository
from src.infrastructure.security.jwt_service import JWTService
from src.infrastructure.security.password_hasher import PasswordHasher
from src.infrastructure.security.token_hasher import TokenHasher


class SigninUseCase:
    """Use case for user signin."""

    def __init__(
        self,
        user_repository: UserRepository,
        refresh_token_repository: RefreshTokenRepository,
        password_hasher: PasswordHasher,
        jwt_service: JWTService,
        token_hasher: TokenHasher,
        refresh_token_expires_in_days: int = 7,
    ):
        """
        Initialize signin use case.

        Args:
            user_repository: User repository
            refresh_token_repository: Refresh token repository
            password_hasher: Password hasher service
            jwt_service: JWT service
            token_hasher: Token hasher service
            refresh_token_expires_in_days: Days until refresh token expires (default: 7)
        """
        self.user_repository = user_repository
        self.refresh_token_repository = refresh_token_repository
        self.password_hasher = password_hasher
        self.jwt_service = jwt_service
        self.token_hasher = token_hasher
        self.refresh_token_expires_in_days = refresh_token_expires_in_days

    async def execute(
        self,
        request: SigninRequest,
        client_ip: str = None,
        user_agent: str = None,
    ) -> Tuple[SigninResponse, str, str]:
        """
        Execute signin use case.

        Args:
            request: Signin request DTO
            client_ip: Client IP address (optional)
            user_agent: User agent string (optional)

        Returns:
            Tuple of (SigninResponse, access_token, refresh_token_plain)

        Raises:
            UserNotFoundError: If user not found
            InvalidCredentialsError: If credentials are invalid
            UserInactiveError: If user is inactive
        """
        # Find user by email
        user = await self.user_repository.find_by_email(request.email)
        if not user:
            raise InvalidCredentialsError("Invalid email or password")

        # Check if user is active
        if not user.is_active:
            raise UserInactiveError("User account is inactive")

        # Verify password
        if not user.password_hash or not self.password_hasher.verify(
            request.password, user.password_hash
        ):
            raise InvalidCredentialsError("Invalid email or password")

        # Generate access token
        access_token = self.jwt_service.generate_access_token(user.id)

        # Generate refresh token
        refresh_token_plain, refresh_token_hash = self.token_hasher.generate_token()
        jti = secrets.token_urlsafe(32)  # JWT ID for refresh token

        refresh_token = RefreshToken.create(
            user_id=user.id,
            token_hash=refresh_token_hash,
            jti=jti,
            expires_in_days=self.refresh_token_expires_in_days,
            created_by_ip=client_ip,
            user_agent=user_agent,
        )

        # Save refresh token
        await self.refresh_token_repository.save(refresh_token)

        return (
            SigninResponse(
                user_id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                is_active=user.is_active,
            ),
            access_token,
            refresh_token_plain,
        )

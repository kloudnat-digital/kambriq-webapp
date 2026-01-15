"""
FastAPI Dependencies

Dependency injection for repositories, services, and use cases.
"""

import os
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.use_cases.logout import LogoutUseCase
from src.application.use_cases.me import MeQueryUseCase
from src.application.use_cases.refresh import RefreshTokenUseCase
from src.application.use_cases.reset_password import (
    ResetPasswordConfirmUseCase,
    ResetPasswordRequestUseCase,
)
from src.application.use_cases.signin import SigninUseCase
from src.application.use_cases.signup import SignupUseCase
from src.infrastructure.database.base import get_async_session_maker
from src.infrastructure.repositories import (
    PasswordResetTokenRepositoryImpl,
    RefreshTokenRepositoryImpl,
    RoleRepositoryImpl,
    UserRepositoryImpl,
)
from src.infrastructure.security import JWTService, PasswordHasher, TokenHasher


@lru_cache
def get_database_url() -> str:
    """Get database URL from environment variable."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is required")
    return database_url


@lru_cache
def get_jwt_secret() -> str:
    """Get JWT secret from environment variable."""
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise ValueError("JWT_SECRET environment variable is required")
    return secret


async def get_db_session() -> AsyncSession:
    """
    Dependency to get database session.

    Yields:
        AsyncSession instance
    """
    database_url = get_database_url()
    session_maker = get_async_session_maker(database_url)
    async with session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


def get_password_hasher() -> PasswordHasher:
    """Dependency to get password hasher."""
    return PasswordHasher()


def get_jwt_service() -> JWTService:
    """Dependency to get JWT service."""
    secret = get_jwt_secret()
    expires_in = int(os.getenv("JWT_EXPIRES_IN", "900"))  # Default 15 minutes
    return JWTService(secret_key=secret, access_token_expires_in=expires_in)


def get_token_hasher() -> TokenHasher:
    """Dependency to get token hasher."""
    secret = get_jwt_secret()
    return TokenHasher(secret_key=secret)


def get_user_repository(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> UserRepositoryImpl:
    """Dependency to get user repository."""
    return UserRepositoryImpl(session)


def get_role_repository(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> RoleRepositoryImpl:
    """Dependency to get role repository."""
    return RoleRepositoryImpl(session)


def get_refresh_token_repository(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> RefreshTokenRepositoryImpl:
    """Dependency to get refresh token repository."""
    return RefreshTokenRepositoryImpl(session)


def get_password_reset_token_repository(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> PasswordResetTokenRepositoryImpl:
    """Dependency to get password reset token repository."""
    return PasswordResetTokenRepositoryImpl(session)


def get_signup_use_case(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    password_hasher: Annotated[PasswordHasher, Depends(get_password_hasher)],
) -> SignupUseCase:
    """Dependency to get signup use case."""
    user_repo = get_user_repository(session)
    return SignupUseCase(user_repository=user_repo, password_hasher=password_hasher)


def get_signin_use_case(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    password_hasher: Annotated[PasswordHasher, Depends(get_password_hasher)],
    jwt_service: Annotated[JWTService, Depends(get_jwt_service)],
    token_hasher: Annotated[TokenHasher, Depends(get_token_hasher)],
) -> SigninUseCase:
    """Dependency to get signin use case."""
    user_repo = get_user_repository(session)
    refresh_token_repo = get_refresh_token_repository(session)
    refresh_expires = int(os.getenv("JWT_REFRESH_EXPIRES_IN", "604800"))  # Default 7 days
    return SigninUseCase(
        user_repository=user_repo,
        refresh_token_repository=refresh_token_repo,
        password_hasher=password_hasher,
        jwt_service=jwt_service,
        token_hasher=token_hasher,
        refresh_token_expires_in_days=refresh_expires // 86400,
    )


def get_logout_use_case(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    token_hasher: Annotated[TokenHasher, Depends(get_token_hasher)],
) -> LogoutUseCase:
    """Dependency to get logout use case."""
    refresh_token_repo = get_refresh_token_repository(session)
    return LogoutUseCase(refresh_token_repository=refresh_token_repo, token_hasher=token_hasher)


def get_reset_password_request_use_case(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    token_hasher: Annotated[TokenHasher, Depends(get_token_hasher)],
) -> ResetPasswordRequestUseCase:
    """Dependency to get reset password request use case."""
    user_repo = get_user_repository(session)
    password_reset_token_repo = get_password_reset_token_repository(session)
    return ResetPasswordRequestUseCase(
        user_repository=user_repo,
        password_reset_token_repository=password_reset_token_repo,
        token_hasher=token_hasher,
    )


def get_reset_password_confirm_use_case(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    password_hasher: Annotated[PasswordHasher, Depends(get_password_hasher)],
    token_hasher: Annotated[TokenHasher, Depends(get_token_hasher)],
) -> ResetPasswordConfirmUseCase:
    """Dependency to get reset password confirm use case."""
    user_repo = get_user_repository(session)
    password_reset_token_repo = get_password_reset_token_repository(session)
    refresh_token_repo = get_refresh_token_repository(session)
    return ResetPasswordConfirmUseCase(
        user_repository=user_repo,
        password_reset_token_repository=password_reset_token_repo,
        refresh_token_repository=refresh_token_repo,
        password_hasher=password_hasher,
        token_hasher=token_hasher,
    )


def get_me_query_use_case(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> MeQueryUseCase:
    """Dependency to get me query use case."""
    user_repo = get_user_repository(session)
    return MeQueryUseCase(user_repository=user_repo)


def get_refresh_token_use_case(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    jwt_service: Annotated[JWTService, Depends(get_jwt_service)],
    token_hasher: Annotated[TokenHasher, Depends(get_token_hasher)],
) -> RefreshTokenUseCase:
    """Dependency to get refresh token use case."""
    user_repo = get_user_repository(session)
    refresh_token_repo = get_refresh_token_repository(session)
    refresh_expires = int(os.getenv("JWT_REFRESH_EXPIRES_IN", "604800"))  # Default 7 days
    return RefreshTokenUseCase(
        user_repository=user_repo,
        refresh_token_repository=refresh_token_repo,
        jwt_service=jwt_service,
        token_hasher=token_hasher,
        refresh_token_expires_in_days=refresh_expires // 86400,
    )

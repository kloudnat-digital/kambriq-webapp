"""
Auth Router

FastAPI router for authentication endpoints.
"""

import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.dtos.reset_password import (
    ResetPasswordConfirmRequest as ResetPasswordConfirmRequestDTO,
    ResetPasswordRequestRequest as ResetPasswordRequestRequestDTO,
)
from src.application.dtos.signin import SigninRequest as SigninRequestDTO
from src.application.dtos.signup import SignupRequest as SignupRequestDTO
from src.application.use_cases.logout import LogoutUseCase
from src.application.use_cases.me import MeQueryUseCase
from src.application.use_cases.refresh import RefreshTokenUseCase
from src.application.use_cases.reset_password import (
    ResetPasswordConfirmUseCase,
    ResetPasswordRequestUseCase,
)
from src.application.use_cases.signin import SigninUseCase
from src.application.use_cases.signup import SignupUseCase
from src.domain.exceptions.auth_exceptions import (
    InvalidCredentialsError,
    PasswordResetTokenExpiredError,
    PasswordResetTokenNotFoundError,
    PasswordResetTokenUsedError,
    TokenExpiredError,
    TokenInvalidError,
    UserInactiveError,
)
from src.domain.exceptions.user_exceptions import EmailAlreadyExistsError, UserNotFoundError
from src.infrastructure.security import JWTService
from src.presentation.dependencies import (
    get_db_session,
    get_jwt_service,
    get_logout_use_case,
    get_me_query_use_case,
    get_refresh_token_use_case,
    get_reset_password_confirm_use_case,
    get_reset_password_request_use_case,
    get_signin_use_case,
    get_signup_use_case,
)
from src.presentation.schemas.me import MeResponse
from src.presentation.schemas.reset_password import (
    ResetPasswordConfirmRequest,
    ResetPasswordRequestRequest,
)
from src.presentation.schemas.signin import SigninRequest, SigninResponse
from src.presentation.schemas.signup import SignupRequest, SignupResponse

router = APIRouter(prefix="/auth", tags=["authentication"])

security = HTTPBearer()


def get_cookie_settings() -> dict:
    """Get cookie settings based on environment."""
    is_production = os.getenv("ENV", "development") == "production"
    same_site = os.getenv("COOKIE_SAME_SITE", "lax")
    secure = os.getenv("COOKIE_SECURE", "false").lower() == "true" or is_production

    return {
        "httponly": True,
        "samesite": same_site,
        "secure": secure,
        "path": "/",
    }


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: SignupRequest,
    signup_use_case: Annotated[SignupUseCase, Depends(get_signup_use_case)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """
    Register a new user.

    Creates a new user account with the provided information.
    """
    try:
        dto = SignupRequestDTO(
            email=request.email,
            password=request.password,
            first_name=request.first_name,
            last_name=request.last_name,
            phone_number=request.phone_number,
            terms_accepted=request.terms_accepted,
        )

        response = await signup_use_case.execute(dto)
        await db.commit()

        return SignupResponse(
            user_id=response.user_id,
            email=response.email,
            first_name=response.first_name,
            last_name=response.last_name,
        )
    except EmailAlreadyExistsError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during signup",
        )


@router.post("/signin", response_model=SigninResponse, status_code=status.HTTP_200_OK)
async def signin(
    request: SigninRequest,
    response: Response,
    fastapi_request: Request,
    signin_use_case: Annotated[SigninUseCase, Depends(get_signin_use_case)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """
    Authenticate user and return access/refresh tokens in HttpOnly cookies.

    Returns user information and sets HttpOnly cookies for access and refresh tokens.
    """
    try:
        dto = SigninRequestDTO(email=request.email, password=request.password)

        client_ip = fastapi_request.client.host if fastapi_request.client else None
        user_agent = fastapi_request.headers.get("user-agent")

        signin_response, access_token, refresh_token = await signin_use_case.execute(
            dto, client_ip=client_ip, user_agent=user_agent
        )
        await db.commit()

        cookie_settings = get_cookie_settings()

        # Set access token cookie
        response.set_cookie(
            key="access_token",
            value=access_token,
            max_age=int(os.getenv("JWT_EXPIRES_IN", "900")),
            **cookie_settings,
        )

        # Set refresh token cookie
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            max_age=int(os.getenv("JWT_REFRESH_EXPIRES_IN", "604800")),
            **cookie_settings,
        )

        return SigninResponse(
            user_id=signin_response.user_id,
            email=signin_response.email,
            first_name=signin_response.first_name,
            last_name=signin_response.last_name,
            is_active=signin_response.is_active,
        )
    except (InvalidCredentialsError, UserNotFoundError):
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    except UserInactiveError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during signin",
        )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    fastapi_request: Request,
    logout_use_case: Annotated[LogoutUseCase, Depends(get_logout_use_case)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """
    Logout user by revoking refresh token.

    Revokes the refresh token and clears cookies.
    """
    try:
        refresh_token = fastapi_request.cookies.get("refresh_token")

        if refresh_token:
            await logout_use_case.execute(refresh_token)
            await db.commit()

        # Clear cookies
        cookie_settings = get_cookie_settings()
        response.delete_cookie(key="access_token", **cookie_settings)
        response.delete_cookie(key="refresh_token", **cookie_settings)

        return None
    except Exception:
        await db.rollback()
        # Still clear cookies even if error
        cookie_settings = get_cookie_settings()
        response.delete_cookie(key="access_token", **cookie_settings)
        response.delete_cookie(key="refresh_token", **cookie_settings)
        return None


@router.post("/resetpassword/request", status_code=status.HTTP_202_ACCEPTED)
async def reset_password_request(
    request: ResetPasswordRequestRequest,
    fastapi_request: Request,
    reset_use_case: Annotated[
        ResetPasswordRequestUseCase, Depends(get_reset_password_request_use_case)
    ],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """
    Request password reset.

    Always returns 202 to prevent email enumeration (security best practice).
    Token is sent via email (not implemented in this scope).
    """
    try:
        dto = ResetPasswordRequestRequestDTO(email=request.email)

        client_ip = fastapi_request.client.host if fastapi_request.client else None

        # Generate token (but don't reveal if email exists)
        await reset_use_case.execute(dto, client_ip=client_ip)
        await db.commit()

        # Always return 202 (even if email doesn't exist)
        return {"message": "If the email exists, a reset link has been sent"}
    except Exception:
        await db.rollback()
        # Still return 202 to prevent email enumeration
        return {"message": "If the email exists, a reset link has been sent"}


@router.post("/resetpassword/confirm", status_code=status.HTTP_200_OK)
async def reset_password_confirm(
    request: ResetPasswordConfirmRequest,
    reset_use_case: Annotated[
        ResetPasswordConfirmUseCase, Depends(get_reset_password_confirm_use_case)
    ],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """
    Confirm password reset with token.

    Validates token and updates password. Revokes all refresh tokens for security.
    """
    try:
        dto = ResetPasswordConfirmRequestDTO(token=request.token, new_password=request.new_password)

        await reset_use_case.execute(dto)
        await db.commit()

        return {"message": "Password has been reset successfully"}
    except (
        PasswordResetTokenNotFoundError,
        PasswordResetTokenExpiredError,
        PasswordResetTokenUsedError,
    ) as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during password reset",
        )


@router.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh(
    response: Response,
    fastapi_request: Request,
    refresh_use_case: Annotated[RefreshTokenUseCase, Depends(get_refresh_token_use_case)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    """
    Refresh access token using refresh token.

    Returns new access token and refresh token in HttpOnly cookies.
    """
    try:
        refresh_token = fastapi_request.cookies.get("refresh_token")

        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token not found",
            )

        client_ip = fastapi_request.client.host if fastapi_request.client else None
        user_agent = fastapi_request.headers.get("user-agent")

        access_token, new_refresh_token = await refresh_use_case.execute(
            refresh_token, client_ip=client_ip, user_agent=user_agent
        )
        await db.commit()

        cookie_settings = get_cookie_settings()

        # Set new access token cookie
        response.set_cookie(
            key="access_token",
            value=access_token,
            max_age=int(os.getenv("JWT_EXPIRES_IN", "900")),
            **cookie_settings,
        )

        # Set new refresh token cookie
        response.set_cookie(
            key="refresh_token",
            value=new_refresh_token,
            max_age=int(os.getenv("JWT_REFRESH_EXPIRES_IN", "604800")),
            **cookie_settings,
        )

        return {"message": "Tokens refreshed successfully"}
    except (TokenInvalidError, TokenExpiredError):
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during token refresh",
        )


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    jwt_service: Annotated[JWTService, Depends(get_jwt_service)],
) -> str:
    """
    Dependency to get current user ID from JWT token in Authorization header.

    Used for GET /me endpoint.
    """
    try:
        token = credentials.credentials
        user_id = jwt_service.get_user_id_from_token(token)
        return str(user_id)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


@router.get("/me", response_model=MeResponse, status_code=status.HTTP_200_OK)
async def me(
    user_id: Annotated[str, Depends(get_current_user_id)],
    me_use_case: Annotated[MeQueryUseCase, Depends(get_me_query_use_case)],
):
    """
    Get current user information.

    Requires Authorization: Bearer <access_token> header.
    """
    from uuid import UUID

    try:
        user_uuid = UUID(user_id)
        response = await me_use_case.execute(user_uuid)

        # Convert to Pydantic schema
        from src.presentation.schemas.me import AddressResponse, RoleResponse

        address_response = None
        if response.address:
            address_response = AddressResponse(
                line=response.address.line,
                complement=response.address.complement,
                postal_code=response.address.postal_code,
                city=response.address.city,
                country=response.address.country,
            )

        roles_response = [RoleResponse(id=role.id, name=role.name) for role in response.roles]

        return MeResponse(
            user_id=response.user_id,
            email=response.email,
            first_name=response.first_name,
            last_name=response.last_name,
            phone_number=response.phone_number,
            address=address_response,
            avatar_url=response.avatar_url,
            is_active=response.is_active,
            terms_accepted=response.terms_accepted,
            roles=roles_response,
        )
    except (UserNotFoundError, UserInactiveError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND
            if isinstance(e, UserNotFoundError)
            else status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving user information",
        )

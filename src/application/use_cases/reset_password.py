"""
Reset Password Use Cases

Handles password reset request and confirmation.
"""


from src.application.dtos.reset_password import (
    ResetPasswordConfirmRequest,
    ResetPasswordRequestRequest,
)
from src.domain.entities.password_reset_token import PasswordResetToken
from src.domain.exceptions.auth_exceptions import (
    PasswordResetTokenExpiredError,
    PasswordResetTokenNotFoundError,
    PasswordResetTokenUsedError,
)
from src.domain.exceptions.user_exceptions import UserNotFoundError
from src.domain.repositories.password_reset_token_repository import (
    PasswordResetTokenRepository,
)
from src.domain.repositories.refresh_token_repository import RefreshTokenRepository
from src.domain.repositories.user_repository import UserRepository
from src.infrastructure.security.password_hasher import PasswordHasher
from src.infrastructure.security.token_hasher import TokenHasher


class ResetPasswordRequestUseCase:
    """Use case for requesting password reset."""

    def __init__(
        self,
        user_repository: UserRepository,
        password_reset_token_repository: PasswordResetTokenRepository,
        token_hasher: TokenHasher,
        token_expires_in_hours: int = 24,
    ):
        """
        Initialize reset password request use case.

        Args:
            user_repository: User repository
            password_reset_token_repository: Password reset token repository
            token_hasher: Token hasher service
            token_expires_in_hours: Hours until token expires (default: 24)
        """
        self.user_repository = user_repository
        self.password_reset_token_repository = password_reset_token_repository
        self.token_hasher = token_hasher
        self.token_expires_in_hours = token_expires_in_hours

    async def execute(
        self,
        request: ResetPasswordRequestRequest,
        client_ip: str = None,
    ) -> str:
        """
        Execute reset password request use case.

        Args:
            request: Reset password request DTO
            client_ip: Client IP address (optional)

        Returns:
            Plain text reset token (to send via email)

        Note:
            Always returns a token, even if email doesn't exist (security: prevent email enumeration)
        """
        # Find user by email
        user = await self.user_repository.find_by_email(request.email)

        # If user doesn't exist, still return a token (security: prevent email enumeration)
        # But don't save it to DB
        if not user:
            # Generate a fake token to return (but don't save it)
            token_plain, _ = self.token_hasher.generate_token()
            return token_plain

        # Generate reset token
        token_plain, token_hash = self.token_hasher.generate_token()

        # Create password reset token entity
        reset_token = PasswordResetToken.create(
            user_id=user.id,
            token_hash=token_hash,
            expires_in_hours=self.token_expires_in_hours,
            created_by_ip=client_ip,
        )

        # Save token
        await self.password_reset_token_repository.save(reset_token)

        return token_plain


class ResetPasswordConfirmUseCase:
    """Use case for confirming password reset."""

    def __init__(
        self,
        user_repository: UserRepository,
        password_reset_token_repository: PasswordResetTokenRepository,
        refresh_token_repository: RefreshTokenRepository,
        password_hasher: PasswordHasher,
        token_hasher: TokenHasher,
    ):
        """
        Initialize reset password confirm use case.

        Args:
            user_repository: User repository
            password_reset_token_repository: Password reset token repository
            refresh_token_repository: Refresh token repository
            password_hasher: Password hasher service
            token_hasher: Token hasher service
        """
        self.user_repository = user_repository
        self.password_reset_token_repository = password_reset_token_repository
        self.refresh_token_repository = refresh_token_repository
        self.password_hasher = password_hasher
        self.token_hasher = token_hasher

    async def execute(self, request: ResetPasswordConfirmRequest) -> None:
        """
        Execute reset password confirm use case.

        Args:
            request: Reset password confirm request DTO

        Raises:
            PasswordResetTokenNotFoundError: If token not found
            PasswordResetTokenExpiredError: If token expired
            PasswordResetTokenUsedError: If token already used
        """
        # Hash the token to find it in DB
        token_hash = self.token_hasher.hash_token(request.token)

        # Find token by hash
        reset_token = await self.password_reset_token_repository.find_by_token_hash(token_hash)

        if not reset_token:
            raise PasswordResetTokenNotFoundError("Password reset token not found")

        # Check if token is used
        if reset_token.is_used:
            raise PasswordResetTokenUsedError("Password reset token already used")

        # Check if token is expired
        if reset_token.is_expired:
            raise PasswordResetTokenExpiredError("Password reset token expired")

        # Find user
        user = await self.user_repository.find_by_id(reset_token.user_id)
        if not user:
            raise UserNotFoundError("User not found")

        # Hash new password
        new_password_hash = self.password_hasher.hash(request.new_password)

        # Update user password
        user.update_password(new_password_hash)
        await self.user_repository.save(user)

        # Mark token as used
        reset_token.mark_as_used()
        await self.password_reset_token_repository.save(reset_token)

        # Revoke all refresh tokens for security (user must re-authenticate)
        await self.refresh_token_repository.revoke_all_for_user(user.id)

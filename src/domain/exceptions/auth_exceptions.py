"""
Authentication Domain Exceptions

Business logic exceptions related to authentication.
"""


class AuthenticationError(Exception):
    """Base exception for authentication-related errors."""


class InvalidCredentialsError(AuthenticationError):
    """Raised when credentials are invalid."""


class UserInactiveError(AuthenticationError):
    """Raised when trying to authenticate an inactive user."""


class TokenExpiredError(AuthenticationError):
    """Raised when a token has expired."""


class TokenInvalidError(AuthenticationError):
    """Raised when a token is invalid."""


class PasswordResetTokenExpiredError(AuthenticationError):
    """Raised when a password reset token has expired."""


class PasswordResetTokenUsedError(AuthenticationError):
    """Raised when a password reset token has already been used."""


class PasswordResetTokenNotFoundError(AuthenticationError):
    """Raised when a password reset token is not found."""

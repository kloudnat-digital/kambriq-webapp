"""
Authentication Domain Exceptions

Business logic exceptions related to authentication.
"""


class AuthenticationError(Exception):
    """Base exception for authentication-related errors."""
    pass


class InvalidCredentialsError(AuthenticationError):
    """Raised when credentials are invalid."""
    pass


class UserInactiveError(AuthenticationError):
    """Raised when trying to authenticate an inactive user."""
    pass


class TokenExpiredError(AuthenticationError):
    """Raised when a token has expired."""
    pass


class TokenInvalidError(AuthenticationError):
    """Raised when a token is invalid."""
    pass


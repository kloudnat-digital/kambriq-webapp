"""
Domain Exceptions

Business logic exceptions. No HTTP exceptions here.
"""

from .auth_exceptions import (
    AuthenticationError,
    InvalidCredentialsError,
    TokenExpiredError,
    TokenInvalidError,
    UserInactiveError,
)
from .user_exceptions import (
    EmailAlreadyExistsError,
    UserNotFoundError,
)

__all__ = [
    "AuthenticationError",
    "InvalidCredentialsError",
    "TokenExpiredError",
    "TokenInvalidError",
    "UserInactiveError",
    "EmailAlreadyExistsError",
    "UserNotFoundError",
]


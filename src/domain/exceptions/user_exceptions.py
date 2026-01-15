"""
User Domain Exceptions

Business logic exceptions related to users.
"""


class UserError(Exception):
    """Base exception for user-related errors."""
    pass


class UserNotFoundError(UserError):
    """Raised when a user is not found."""
    pass


class EmailAlreadyExistsError(UserError):
    """Raised when trying to create a user with an existing email."""
    pass


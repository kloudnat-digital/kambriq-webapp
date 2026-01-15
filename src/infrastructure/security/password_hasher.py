"""
Password Hasher Service

Bcrypt password hashing and verification.
"""

from passlib.context import CryptContext


class PasswordHasher:
    """
    Service for password hashing and verification using bcrypt.
    """

    def __init__(self, rounds: int = 12):
        """
        Initialize password hasher.

        Args:
            rounds: Number of bcrypt rounds (default: 12, recommended: 12-14)
        """
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=rounds)

    def hash(self, password: str) -> str:
        """
        Hash a password.

        Args:
            password: Plain text password

        Returns:
            Hashed password string
        """
        if not password:
            raise ValueError("Password cannot be empty")
        return self.pwd_context.hash(password)

    def verify(self, password: str, hashed: str) -> bool:
        """
        Verify a password against a hash.

        Args:
            password: Plain text password to verify
            hashed: Hashed password to compare against

        Returns:
            True if password matches hash, False otherwise
        """
        if not password or not hashed:
            return False
        return self.pwd_context.verify(password, hashed)


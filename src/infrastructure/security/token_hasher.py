"""
Token Hasher Service

HMAC-SHA256 hashing for refresh tokens and password reset tokens.
Tokens are never stored in plaintext in the database.
"""

import hashlib
import hmac
import secrets
from typing import Tuple


class TokenHasher:
    """
    Service for hashing tokens (refresh tokens, password reset tokens).
    Uses HMAC-SHA256 for secure hashing.
    """

    def __init__(self, secret_key: str):
        """
        Initialize token hasher.

        Args:
            secret_key: Secret key for HMAC (should be JWT_SECRET or similar)
        """
        if not secret_key:
            raise ValueError("Secret key cannot be empty")
        self.secret_key = secret_key

    def generate_token(self) -> Tuple[str, str]:
        """
        Generate a random token and its hash.

        Returns:
            Tuple of (token_plain, token_hash)
            - token_plain: Plain text token (to send to client/email)
            - token_hash: Hashed token (to store in database)
        """
        # Generate random token (32 bytes = 256 bits)
        token_plain = secrets.token_urlsafe(32)

        # Hash with HMAC-SHA256
        token_hash = self.hash_token(token_plain)

        return token_plain, token_hash

    def hash_token(self, token: str) -> str:
        """
        Hash a token using HMAC-SHA256.

        Args:
            token: Plain text token

        Returns:
            Hashed token (hex string)
        """
        if not token:
            raise ValueError("Token cannot be empty")

        hash_obj = hmac.new(
            self.secret_key.encode("utf-8"),
            token.encode("utf-8"),
            hashlib.sha256,
        )
        return hash_obj.hexdigest()

    def verify_token(self, token_plain: str, stored_hash: str) -> bool:
        """
        Verify if a plain token matches a stored hash.

        Args:
            token_plain: Plain text token to verify
            stored_hash: Stored hash to compare against

        Returns:
            True if token matches hash, False otherwise
        """
        if not token_plain or not stored_hash:
            return False

        computed_hash = self.hash_token(token_plain)

        # Use constant-time comparison to prevent timing attacks
        return hmac.compare_digest(computed_hash, stored_hash)

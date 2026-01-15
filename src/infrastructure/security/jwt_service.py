"""
JWT Service

JWT token generation and validation for access tokens.
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt


class JWTService:
    """
    Service for JWT token generation and validation.
    """

    def __init__(
        self,
        secret_key: str,
        algorithm: str = "HS256",
        access_token_expires_in: int = 900,  # 15 minutes
    ):
        """
        Initialize JWT service.

        Args:
            secret_key: Secret key for signing tokens
            algorithm: JWT algorithm (default: HS256)
            access_token_expires_in: Access token expiration in seconds (default: 900 = 15 min)
        """
        if not secret_key:
            raise ValueError("Secret key cannot be empty")

        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expires_in = access_token_expires_in

    def generate_access_token(self, user_id: UUID, additional_claims: Optional[dict] = None) -> str:
        """
        Generate an access token (JWT).

        Args:
            user_id: User ID (subject)
            additional_claims: Optional additional claims to include

        Returns:
            JWT token string
        """
        now = datetime.utcnow()
        expires_at = now + timedelta(seconds=self.access_token_expires_in)

        payload = {
            "sub": str(user_id),  # Subject (user ID)
            "iat": int(now.timestamp()),  # Issued at
            "exp": int(expires_at.timestamp()),  # Expiration
            "type": "access",  # Token type
        }

        # Add additional claims if provided
        if additional_claims:
            payload.update(additional_claims)

        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token: str) -> dict:
        """
        Verify and decode a JWT token.

        Args:
            token: JWT token string

        Returns:
            Decoded token payload

        Raises:
            JWTError: If token is invalid or expired
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError as e:
            raise JWTError(f"Invalid token: {str(e)}")

    def get_user_id_from_token(self, token: str) -> UUID:
        """
        Extract user ID from a JWT token.

        Args:
            token: JWT token string

        Returns:
            User ID (UUID)

        Raises:
            JWTError: If token is invalid or expired
        """
        payload = self.verify_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise JWTError("Token missing 'sub' claim")
        return UUID(user_id_str)

    def is_token_expired(self, token: str) -> bool:
        """
        Check if a token is expired (without verifying signature).

        Args:
            token: JWT token string

        Returns:
            True if token is expired, False otherwise
        """
        try:
            # Decode without verification to check expiration
            payload = jwt.decode(
                token, self.secret_key, algorithms=[self.algorithm], options={"verify_signature": True}
            )
            exp = payload.get("exp")
            if exp:
                return datetime.utcnow().timestamp() > exp
            return True  # No expiration = expired
        except JWTError:
            return True  # Invalid token = expired


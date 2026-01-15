"""
Unit tests for JWTService
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from jose import JWTError

from src.infrastructure.security.jwt_service import JWTService


class TestJWTService:
    """Test suite for JWTService."""

    @pytest.fixture
    def jwt_service(self):
        """Create JWTService instance."""
        return JWTService(secret_key="test-secret-key-12345", access_token_expires_in=900)

    def test_generate_access_token(self, jwt_service):
        """Test generating an access token."""
        user_id = uuid4()

        token = jwt_service.generate_access_token(user_id)

        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_generate_token_with_additional_claims(self, jwt_service):
        """Test generating token with additional claims."""
        user_id = uuid4()
        additional_claims = {"email": "test@example.com", "role": "admin"}

        token = jwt_service.generate_access_token(user_id, additional_claims=additional_claims)

        # Verify token contains additional claims
        payload = jwt_service.verify_token(token)
        assert payload["email"] == "test@example.com"
        assert payload["role"] == "admin"

    def test_verify_valid_token(self, jwt_service):
        """Test verifying a valid token."""
        user_id = uuid4()

        token = jwt_service.generate_access_token(user_id)
        payload = jwt_service.verify_token(token)

        assert payload["sub"] == str(user_id)
        assert payload["type"] == "access"
        assert "iat" in payload
        assert "exp" in payload

    def test_verify_invalid_token_fails(self, jwt_service):
        """Test that verifying invalid token fails."""
        invalid_token = "invalid.token.here"

        with pytest.raises(JWTError):
            jwt_service.verify_token(invalid_token)

    def test_verify_token_wrong_secret_fails(self):
        """Test that verifying token with wrong secret fails."""
        service1 = JWTService(secret_key="secret1")
        service2 = JWTService(secret_key="secret2")

        user_id = uuid4()
        token = service1.generate_access_token(user_id)

        with pytest.raises(JWTError):
            service2.verify_token(token)

    def test_get_user_id_from_token(self, jwt_service):
        """Test extracting user ID from token."""
        user_id = uuid4()

        token = jwt_service.generate_access_token(user_id)
        extracted_id = jwt_service.get_user_id_from_token(token)

        assert extracted_id == user_id

    def test_get_user_id_invalid_token_fails(self, jwt_service):
        """Test that extracting user ID from invalid token fails."""
        invalid_token = "invalid.token.here"

        with pytest.raises(JWTError):
            jwt_service.get_user_id_from_token(invalid_token)

    def test_token_expiration(self, jwt_service):
        """Test that token expires correctly."""
        # Create service with short expiration
        short_service = JWTService(secret_key="test-secret", access_token_expires_in=1)
        user_id = uuid4()

        token = short_service.generate_access_token(user_id)

        # Token should be valid immediately
        assert short_service.is_token_expired(token) is False

        # Wait for expiration (2 seconds)
        import time

        time.sleep(2)

        # Token should be expired
        assert short_service.is_token_expired(token) is True

    def test_token_contains_expiration(self, jwt_service):
        """Test that token contains correct expiration time."""
        user_id = uuid4()
        expires_in = 900  # 15 minutes

        token = jwt_service.generate_access_token(user_id)
        payload = jwt_service.verify_token(token)

        # Check expiration is approximately correct (within 5 seconds)
        now = datetime.utcnow().timestamp()
        expected_exp = now + expires_in

        assert abs(payload["exp"] - expected_exp) < 5

    def test_empty_secret_key_fails(self):
        """Test that empty secret key fails."""
        with pytest.raises(ValueError, match="Secret key cannot be empty"):
            JWTService(secret_key="")


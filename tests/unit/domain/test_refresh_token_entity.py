"""
Unit tests for RefreshToken entity
"""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from src.domain.entities.refresh_token import RefreshToken


class TestRefreshToken:
    """Test suite for RefreshToken entity."""

    def test_create_refresh_token_success(self):
        """Test creating a valid refresh token."""
        user_id = uuid4()
        token_hash = "hashed_token_123"
        jti = "jti_123"

        token = RefreshToken.create(
            user_id=user_id,
            token_hash=token_hash,
            jti=jti,
        )

        assert token.user_id == user_id
        assert token.token_hash == token_hash
        assert token.jti == jti
        assert token.revoked_at is None
        assert token.replaced_by_token_id is None
        assert isinstance(token.id, type(uuid4()))
        assert isinstance(token.issued_at, datetime)
        assert isinstance(token.expires_at, datetime)
        assert token.expires_at > token.issued_at

    def test_create_refresh_token_with_optional_fields(self):
        """Test creating refresh token with optional fields."""
        user_id = uuid4()

        token = RefreshToken.create(
            user_id=user_id,
            token_hash="hash",
            jti="jti_123",
            expires_in_days=14,
            created_by_ip="192.168.1.1",
            user_agent="Mozilla/5.0",
        )

        assert token.created_by_ip == "192.168.1.1"
        assert token.user_agent == "Mozilla/5.0"
        assert token.expires_at > token.issued_at + timedelta(days=13)

    def test_create_refresh_token_empty_hash_fails(self):
        """Test that creating token with empty hash fails."""
        with pytest.raises(ValueError, match="Token hash cannot be empty"):
            RefreshToken.create(
                user_id=uuid4(),
                token_hash="",
                jti="jti_123",
            )

    def test_create_refresh_token_empty_jti_fails(self):
        """Test that creating token with empty JTI fails."""
        with pytest.raises(ValueError, match="JTI cannot be empty"):
            RefreshToken.create(
                user_id=uuid4(),
                token_hash="hash",
                jti="",
            )

    def test_revoke_token(self):
        """Test revoking a token."""
        token = RefreshToken.create(
            user_id=uuid4(),
            token_hash="hash",
            jti="jti_123",
        )

        assert token.is_revoked is False
        assert token.is_valid is True

        token.revoke()

        assert token.is_revoked is True
        assert token.is_valid is False
        assert isinstance(token.revoked_at, datetime)

    def test_revoke_token_with_replacement(self):
        """Test revoking a token with replacement."""
        token = RefreshToken.create(
            user_id=uuid4(),
            token_hash="hash",
            jti="jti_123",
        )
        replacement_id = uuid4()

        token.revoke(replaced_by_token_id=replacement_id)

        assert token.is_revoked is True
        assert token.replaced_by_token_id == replacement_id

    def test_revoke_already_revoked_token_fails(self):
        """Test that revoking an already revoked token fails."""
        token = RefreshToken.create(
            user_id=uuid4(),
            token_hash="hash",
            jti="jti_123",
        )
        token.revoke()

        with pytest.raises(ValueError, match="already revoked"):
            token.revoke()

    def test_is_expired(self):
        """Test checking if token is expired."""
        token = RefreshToken.create(
            user_id=uuid4(),
            token_hash="hash",
            jti="jti_123",
            expires_in_days=0,  # Expires immediately (but expires_at is still in future)
        )

        # Token should not be expired immediately after creation
        assert token.is_expired is False

    def test_is_valid(self):
        """Test checking if token is valid."""
        token = RefreshToken.create(
            user_id=uuid4(),
            token_hash="hash",
            jti="jti_123",
        )

        assert token.is_valid is True

        token.revoke()

        assert token.is_valid is False

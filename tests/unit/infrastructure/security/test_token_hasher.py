"""
Unit tests for TokenHasher
"""

import pytest

from src.infrastructure.security.token_hasher import TokenHasher


class TestTokenHasher:
    """Test suite for TokenHasher."""

    @pytest.fixture
    def token_hasher(self):
        """Create TokenHasher instance."""
        return TokenHasher(secret_key="test-secret-key-12345")

    def test_generate_token(self, token_hasher):
        """Test generating a token and its hash."""
        token_plain, token_hash = token_hasher.generate_token()

        assert token_plain is not None
        assert token_hash is not None
        assert token_plain != token_hash
        assert len(token_hash) == 64  # SHA-256 hex = 64 chars

    def test_generate_token_different_tokens(self, token_hasher):
        """Test that generating multiple tokens produces different values."""
        token1_plain, token1_hash = token_hasher.generate_token()
        token2_plain, token2_hash = token_hasher.generate_token()

        assert token1_plain != token2_plain
        assert token1_hash != token2_hash

    def test_hash_token(self, token_hasher):
        """Test hashing a token."""
        token = "test_token_12345"

        token_hash = token_hasher.hash_token(token)

        assert token_hash is not None
        assert len(token_hash) == 64  # SHA-256 hex = 64 chars
        assert token_hash != token

    def test_hash_token_empty_fails(self, token_hasher):
        """Test that hashing empty token fails."""
        with pytest.raises(ValueError, match="Token cannot be empty"):
            token_hasher.hash_token("")

    def test_verify_token_correct(self, token_hasher):
        """Test verifying a correct token."""
        token_plain, token_hash = token_hasher.generate_token()

        result = token_hasher.verify_token(token_plain, token_hash)

        assert result is True

    def test_verify_token_incorrect(self, token_hasher):
        """Test verifying an incorrect token."""
        token_plain, token_hash = token_hasher.generate_token()
        wrong_token = "wrong_token_12345"

        result = token_hasher.verify_token(wrong_token, token_hash)

        assert result is False

    def test_verify_token_different_hash(self, token_hasher):
        """Test verifying token against different hash."""
        token_plain, _ = token_hasher.generate_token()
        _, different_hash = token_hasher.generate_token()

        result = token_hasher.verify_token(token_plain, different_hash)

        assert result is False

    def test_verify_token_empty_token_returns_false(self, token_hasher):
        """Test that verifying empty token returns False."""
        _, token_hash = token_hasher.generate_token()

        result = token_hasher.verify_token("", token_hash)

        assert result is False

    def test_verify_token_empty_hash_returns_false(self, token_hasher):
        """Test that verifying against empty hash returns False."""
        token_plain, _ = token_hasher.generate_token()

        result = token_hasher.verify_token(token_plain, "")

        assert result is False

    def test_hash_deterministic(self, token_hasher):
        """Test that hashing same token produces same hash."""
        token = "test_token_12345"

        hash1 = token_hasher.hash_token(token)
        hash2 = token_hasher.hash_token(token)

        # Same token + same secret = same hash
        assert hash1 == hash2

    def test_different_secrets_produce_different_hashes(self):
        """Test that different secrets produce different hashes."""
        hasher1 = TokenHasher(secret_key="secret1")
        hasher2 = TokenHasher(secret_key="secret2")

        token = "test_token_12345"

        hash1 = hasher1.hash_token(token)
        hash2 = hasher2.hash_token(token)

        assert hash1 != hash2

    def test_empty_secret_key_fails(self):
        """Test that empty secret key fails."""
        with pytest.raises(ValueError, match="Secret key cannot be empty"):
            TokenHasher(secret_key="")


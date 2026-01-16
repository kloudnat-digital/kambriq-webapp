"""
Unit tests for PasswordHasher
"""

import pytest

from src.infrastructure.security.password_hasher import PasswordHasher


class TestPasswordHasher:
    """Test suite for PasswordHasher."""

    def test_hash_password(self):
        """Test hashing a password."""
        hasher = PasswordHasher()
        password = "test_password_123"

        hashed = hasher.hash(password)

        assert hashed != password
        assert hashed.startswith("$2b$")  # Bcrypt hash format
        assert len(hashed) > 50  # Bcrypt hashes are long

    def test_hash_empty_password_fails(self):
        """Test that hashing empty password fails."""
        hasher = PasswordHasher()

        with pytest.raises(ValueError, match="Password cannot be empty"):
            hasher.hash("")

    def test_verify_correct_password(self):
        """Test verifying a correct password."""
        hasher = PasswordHasher()
        password = "test_password_123"

        hashed = hasher.hash(password)
        result = hasher.verify(password, hashed)

        assert result is True

    def test_verify_incorrect_password(self):
        """Test verifying an incorrect password."""
        hasher = PasswordHasher()
        password = "test_password_123"
        wrong_password = "wrong_password"

        hashed = hasher.hash(password)
        result = hasher.verify(wrong_password, hashed)

        assert result is False

    def test_verify_empty_password_returns_false(self):
        """Test that verifying empty password returns False."""
        hasher = PasswordHasher()
        hashed = hasher.hash("test_password")

        result = hasher.verify("", hashed)

        assert result is False

    def test_verify_empty_hash_returns_false(self):
        """Test that verifying against empty hash returns False."""
        hasher = PasswordHasher()

        result = hasher.verify("test_password", "")

        assert result is False

    def test_hash_different_passwords_produce_different_hashes(self):
        """Test that different passwords produce different hashes."""
        hasher = PasswordHasher()

        hash1 = hasher.hash("password1")
        hash2 = hasher.hash("password2")

        assert hash1 != hash2

    def test_hash_same_password_produces_different_hashes(self):
        """Test that same password produces different hashes (due to salt)."""
        hasher = PasswordHasher()
        password = "same_password"

        hash1 = hasher.hash(password)
        hash2 = hasher.hash(password)

        # Hashes should be different (bcrypt uses random salt)
        assert hash1 != hash2

        # But both should verify correctly
        assert hasher.verify(password, hash1) is True
        assert hasher.verify(password, hash2) is True

    def test_custom_rounds(self):
        """Test hasher with custom rounds."""
        hasher = PasswordHasher(rounds=10)

        password = "test_password"
        hashed = hasher.hash(password)

        assert hasher.verify(password, hashed) is True

"""
Unit tests for User entity
"""

from datetime import datetime
from uuid import uuid4

import pytest

from src.domain.entities.user import User
from src.domain.entities.user_address import UserAddress


class TestUserEntity:
    """Test suite for User entity."""

    def test_create_user_success(self):
        """Test creating a valid user."""
        user = User.create(
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            password_hash="hashed_password",
        )

        assert user.first_name == "John"
        assert user.last_name == "Doe"
        assert user.email == "john.doe@example.com"
        assert user.password_hash == "hashed_password"
        assert user.is_active is True
        assert user.terms_accepted is False
        assert isinstance(user.id, type(uuid4()))
        assert isinstance(user.created_at, datetime)
        assert isinstance(user.updated_at, datetime)

    def test_create_user_with_optional_fields(self):
        """Test creating user with optional fields."""
        address = UserAddress(
            line="123 Main St",
            postal_code="12345",
            city="Paris",
            country="France",
            complement="Apt 4B",
        )
        referrer_id = uuid4()

        user = User.create(
            first_name="Jane",
            last_name="Smith",
            email="jane.smith@example.com",
            password_hash="hashed_password",
            phone_number="+33612345678",
            address=address,
            referrer_id=referrer_id,
            avatar_url="https://example.com/avatar.jpg",
            terms_accepted=True,
        )

        assert user.phone_number == "+33612345678"
        assert user.address == address
        assert user.referrer_id == referrer_id
        assert user.avatar_url == "https://example.com/avatar.jpg"
        assert user.terms_accepted is True

    def test_create_user_empty_first_name_fails(self):
        """Test that creating user with empty first name fails."""
        with pytest.raises(ValueError, match="First name cannot be empty"):
            User.create(
                first_name="",
                last_name="Doe",
                email="test@example.com",
                password_hash="hash",
            )

    def test_create_user_empty_last_name_fails(self):
        """Test that creating user with empty last name fails."""
        with pytest.raises(ValueError, match="Last name cannot be empty"):
            User.create(
                first_name="John",
                last_name="",
                email="test@example.com",
                password_hash="hash",
            )

    def test_create_user_invalid_email_fails(self):
        """Test that creating user with invalid email fails."""
        with pytest.raises(ValueError, match="Invalid email format"):
            User.create(
                first_name="John",
                last_name="Doe",
                email="invalid-email",
                password_hash="hash",
            )

    def test_create_user_email_normalized(self):
        """Test that email is normalized to lowercase."""
        user = User.create(
            first_name="John",
            last_name="Doe",
            email="JOHN.DOE@EXAMPLE.COM",
            password_hash="hash",
        )

        assert user.email == "john.doe@example.com"

    def test_update_password(self):
        """Test updating user password."""
        user = User.create(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="old_hash",
        )

        old_updated_at = user.updated_at
        user.update_password("new_hash")

        assert user.password_hash == "new_hash"
        assert user.updated_at > old_updated_at

    def test_update_password_empty_fails(self):
        """Test that updating password with empty hash fails."""
        user = User.create(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )

        with pytest.raises(ValueError, match="Password hash cannot be empty"):
            user.update_password("")

    def test_activate_user(self):
        """Test activating a user."""
        user = User.create(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )
        user.deactivate()

        assert user.is_active is False

        user.activate()

        assert user.is_active is True

    def test_deactivate_user(self):
        """Test deactivating a user."""
        user = User.create(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )

        assert user.is_active is True

        user.deactivate()

        assert user.is_active is False

    def test_accept_terms(self):
        """Test accepting terms."""
        user = User.create(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )

        assert user.terms_accepted is False

        user.accept_terms()

        assert user.terms_accepted is True

    def test_update_address(self):
        """Test updating user address."""
        user = User.create(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )

        new_address = UserAddress(
            line="456 New St",
            postal_code="67890",
            city="Lyon",
            country="France",
        )

        old_updated_at = user.updated_at
        user.update_address(new_address)

        assert user.address == new_address
        assert user.updated_at > old_updated_at

    def test_full_name_property(self):
        """Test full_name property."""
        user = User.create(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )

        assert user.full_name == "John Doe"

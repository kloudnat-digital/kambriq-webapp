"""
Unit tests for UserAddress value object
"""

import pytest

from src.domain.entities.user_address import UserAddress


class TestUserAddress:
    """Test suite for UserAddress value object."""
    
    def test_create_address_success(self):
        """Test creating a valid address."""
        address = UserAddress(
            line="123 Main Street",
            postal_code="75001",
            city="Paris",
            country="France",
        )
        
        assert address.line == "123 Main Street"
        assert address.postal_code == "75001"
        assert address.city == "Paris"
        assert address.country == "France"
        assert address.complement is None
    
    def test_create_address_with_complement(self):
        """Test creating address with complement."""
        address = UserAddress(
            line="456 Oak Avenue",
            postal_code="69001",
            city="Lyon",
            country="France",
            complement="Apt 4B",
        )
        
        assert address.complement == "Apt 4B"
    
    def test_create_address_empty_line_fails(self):
        """Test that creating address with empty line fails."""
        with pytest.raises(ValueError, match="Address line cannot be empty"):
            UserAddress(
                line="",
                postal_code="12345",
                city="Paris",
                country="France",
            )
    
    def test_create_address_empty_postal_code_fails(self):
        """Test that creating address with empty postal code fails."""
        with pytest.raises(ValueError, match="Postal code cannot be empty"):
            UserAddress(
                line="123 Main St",
                postal_code="",
                city="Paris",
                country="France",
            )
    
    def test_create_address_empty_city_fails(self):
        """Test that creating address with empty city fails."""
        with pytest.raises(ValueError, match="City cannot be empty"):
            UserAddress(
                line="123 Main St",
                postal_code="12345",
                city="",
                country="France",
            )
    
    def test_create_address_empty_country_fails(self):
        """Test that creating address with empty country fails."""
        with pytest.raises(ValueError, match="Country cannot be empty"):
            UserAddress(
                line="123 Main St",
                postal_code="12345",
                city="Paris",
                country="",
            )
    
    def test_address_is_immutable(self):
        """Test that address is immutable (frozen dataclass)."""
        address = UserAddress(
            line="123 Main St",
            postal_code="12345",
            city="Paris",
            country="France",
        )
        
        with pytest.raises(Exception):  # dataclass.FrozenInstanceError
            address.line = "456 New St"


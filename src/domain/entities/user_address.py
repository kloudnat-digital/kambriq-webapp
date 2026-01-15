"""
UserAddress Value Object

Represents a user's address as a value object.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class UserAddress:
    """
    Value object representing a user's address.
    
    Attributes:
        line: Street address line
        complement: Optional address complement (apartment, suite, etc.)
        postal_code: Postal/ZIP code
        city: City name
        country: Country name or code
    """
    
    line: str
    postal_code: str
    city: str
    country: str
    complement: Optional[str] = None
    
    def __post_init__(self) -> None:
        """Validate address fields."""
        if not self.line or not self.line.strip():
            raise ValueError("Address line cannot be empty")
        if not self.postal_code or not self.postal_code.strip():
            raise ValueError("Postal code cannot be empty")
        if not self.city or not self.city.strip():
            raise ValueError("City cannot be empty")
        if not self.country or not self.country.strip():
            raise ValueError("Country cannot be empty")


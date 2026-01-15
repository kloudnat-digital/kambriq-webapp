"""
User Entity

Represents a user in the system.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from .user_address import UserAddress


@dataclass
class User:
    """
    Domain entity representing a user.
    
    Attributes:
        id: Unique identifier
        first_name: User's first name
        last_name: User's last name
        email: User's email address (unique)
        phone_number: Optional phone number
        address: Optional user address
        password_hash: Hashed password (optional, e.g., for OAuth users)
        referrer_id: Optional ID of the user who referred this user
        avatar_url: Optional URL to user's avatar
        is_active: Whether the user account is active
        terms_accepted: Whether the user has accepted terms and conditions
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    
    id: UUID
    first_name: str
    last_name: str
    email: str
    phone_number: Optional[str]
    address: Optional[UserAddress]
    password_hash: Optional[str]
    referrer_id: Optional[UUID]
    avatar_url: Optional[str]
    is_active: bool
    terms_accepted: bool
    created_at: datetime
    updated_at: datetime
    
    def __post_init__(self) -> None:
        """Validate user fields."""
        if not self.first_name or not self.first_name.strip():
            raise ValueError("First name cannot be empty")
        if not self.last_name or not self.last_name.strip():
            raise ValueError("Last name cannot be empty")
        if not self.email or not self.email.strip():
            raise ValueError("Email cannot be empty")
        # Basic email validation
        if "@" not in self.email:
            raise ValueError("Invalid email format")
    
    @classmethod
    def create(
        cls,
        first_name: str,
        last_name: str,
        email: str,
        password_hash: str,
        phone_number: Optional[str] = None,
        address: Optional[UserAddress] = None,
        referrer_id: Optional[UUID] = None,
        avatar_url: Optional[str] = None,
        terms_accepted: bool = False,
    ) -> "User":
        """
        Factory method to create a new User.
        
        Args:
            first_name: User's first name
            last_name: User's last name
            email: User's email address
            password_hash: Hashed password
            phone_number: Optional phone number
            address: Optional user address
            referrer_id: Optional referrer user ID
            avatar_url: Optional avatar URL
            terms_accepted: Whether terms are accepted
            
        Returns:
            New User instance
        """
        now = datetime.utcnow()
        return cls(
            id=uuid4(),
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            email=email.strip().lower(),
            phone_number=phone_number.strip() if phone_number else None,
            address=address,
            password_hash=password_hash,
            referrer_id=referrer_id,
            avatar_url=avatar_url,
            is_active=True,
            terms_accepted=terms_accepted,
            created_at=now,
            updated_at=now,
        )
    
    def update_password(self, new_password_hash: str) -> None:
        """
        Update user password.
        
        Args:
            new_password_hash: New hashed password
        """
        if not new_password_hash:
            raise ValueError("Password hash cannot be empty")
        self.password_hash = new_password_hash
        self.updated_at = datetime.utcnow()
    
    def activate(self) -> None:
        """Activate the user account."""
        self.is_active = True
        self.updated_at = datetime.utcnow()
    
    def deactivate(self) -> None:
        """Deactivate the user account."""
        self.is_active = False
        self.updated_at = datetime.utcnow()
    
    def accept_terms(self) -> None:
        """Mark terms as accepted."""
        self.terms_accepted = True
        self.updated_at = datetime.utcnow()
    
    def update_address(self, address: Optional[UserAddress]) -> None:
        """
        Update user address.
        
        Args:
            address: New address or None to remove
        """
        self.address = address
        self.updated_at = datetime.utcnow()
    
    @property
    def full_name(self) -> str:
        """Get user's full name."""
        return f"{self.first_name} {self.last_name}"


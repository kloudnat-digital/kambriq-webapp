"""
Role Entity

Represents a user role in the system.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4


@dataclass
class Role:
    """
    Domain entity representing a role.
    
    Attributes:
        id: Unique identifier
        name: Role name (e.g., "admin_global", "agent_junior")
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    
    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime
    
    def __post_init__(self) -> None:
        """Validate role fields."""
        if not self.name or not self.name.strip():
            raise ValueError("Role name cannot be empty")
    
    @classmethod
    def create(cls, name: str) -> "Role":
        """
        Factory method to create a new Role.
        
        Args:
            name: Role name
            
        Returns:
            New Role instance
        """
        now = datetime.utcnow()
        return cls(
            id=uuid4(),
            name=name.strip(),
            created_at=now,
            updated_at=now,
        )
    
    def update(self, name: str) -> None:
        """
        Update role name.
        
        Args:
            name: New role name
        """
        if not name or not name.strip():
            raise ValueError("Role name cannot be empty")
        self.name = name.strip()
        self.updated_at = datetime.utcnow()


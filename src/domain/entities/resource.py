"""
Resource Entity

Represents a resource in the permission system.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4


@dataclass
class Resource:
    """
    Domain entity representing a resource.

    Attributes:
        id: Unique identifier
        name: Resource name (e.g., "verify", "land", "kbs")
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime

    def __post_init__(self) -> None:
        """Validate resource fields."""
        if not self.name or not self.name.strip():
            raise ValueError("Resource name cannot be empty")

    @classmethod
    def create(cls, name: str) -> "Resource":
        """
        Factory method to create a new Resource.

        Args:
            name: Resource name

        Returns:
            New Resource instance
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
        Update resource name.

        Args:
            name: New resource name
        """
        if not name or not name.strip():
            raise ValueError("Resource name cannot be empty")
        self.name = name.strip()
        self.updated_at = datetime.utcnow()

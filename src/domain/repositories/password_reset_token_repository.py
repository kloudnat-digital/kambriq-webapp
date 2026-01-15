"""
Password Reset Token Repository Interface

Abstract interface for password reset token repository operations.
"""

from abc import ABC, abstractmethod
from typing import Optional
from uuid import UUID

from ..entities.password_reset_token import PasswordResetToken


class PasswordResetTokenRepository(ABC):
    """Abstract interface for password reset token repository."""
    
    @abstractmethod
    async def find_by_id(self, token_id: UUID) -> Optional[PasswordResetToken]:
        """
        Find password reset token by ID.
        
        Args:
            token_id: Token ID
            
        Returns:
            PasswordResetToken if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def find_by_token_hash(self, token_hash: str) -> Optional[PasswordResetToken]:
        """
        Find password reset token by hash.
        
        Args:
            token_hash: Token hash
            
        Returns:
            PasswordResetToken if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def save(self, token: PasswordResetToken) -> PasswordResetToken:
        """
        Save or update a password reset token.
        
        Args:
            token: PasswordResetToken entity to save
            
        Returns:
            Saved password reset token entity
        """
        pass


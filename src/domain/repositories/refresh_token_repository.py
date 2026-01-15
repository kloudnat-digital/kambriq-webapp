"""
Refresh Token Repository Interface

Abstract interface for refresh token repository operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from ..entities.refresh_token import RefreshToken


class RefreshTokenRepository(ABC):
    """Abstract interface for refresh token repository."""
    
    @abstractmethod
    async def find_by_id(self, token_id: UUID) -> Optional[RefreshToken]:
        """
        Find refresh token by ID.
        
        Args:
            token_id: Token ID
            
        Returns:
            RefreshToken if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def find_by_jti(self, jti: str) -> Optional[RefreshToken]:
        """
        Find refresh token by JTI (JWT ID).
        
        Args:
            jti: JWT ID
            
        Returns:
            RefreshToken if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def find_by_token_hash(self, token_hash: str) -> Optional[RefreshToken]:
        """
        Find refresh token by hash.
        
        Args:
            token_hash: Token hash
            
        Returns:
            RefreshToken if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def find_by_user_id(self, user_id: UUID) -> List[RefreshToken]:
        """
        Find all refresh tokens for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            List of refresh tokens
        """
        pass
    
    @abstractmethod
    async def save(self, token: RefreshToken) -> RefreshToken:
        """
        Save or update a refresh token.
        
        Args:
            token: RefreshToken entity to save
            
        Returns:
            Saved refresh token entity
        """
        pass
    
    @abstractmethod
    async def revoke_all_for_user(self, user_id: UUID) -> None:
        """
        Revoke all refresh tokens for a user.
        
        Args:
            user_id: User ID
        """
        pass


"""
Refresh Token Repository Implementation

SQLAlchemy implementation of RefreshTokenRepository.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.refresh_token import RefreshToken
from src.domain.repositories.refresh_token_repository import (
    RefreshTokenRepository as IRefreshTokenRepository,
)
from src.infrastructure.database.models.refresh_token_model import RefreshTokenModel


class RefreshTokenRepositoryImpl(IRefreshTokenRepository):
    """SQLAlchemy implementation of RefreshTokenRepository."""

    def __init__(self, session: AsyncSession):
        """Initialize refresh token repository."""
        self.session = session

    async def find_by_id(self, token_id: UUID) -> Optional[RefreshToken]:
        """Find refresh token by ID."""
        stmt = select(RefreshTokenModel).where(RefreshTokenModel.id == token_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_jti(self, jti: str) -> Optional[RefreshToken]:
        """Find refresh token by JTI."""
        stmt = select(RefreshTokenModel).where(RefreshTokenModel.jti == jti)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_token_hash(self, token_hash: str) -> Optional[RefreshToken]:
        """Find refresh token by hash."""
        stmt = select(RefreshTokenModel).where(RefreshTokenModel.token_hash == token_hash)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_user_id(self, user_id: UUID) -> List[RefreshToken]:
        """Find all refresh tokens for a user."""
        stmt = select(RefreshTokenModel).where(RefreshTokenModel.user_id == user_id)
        result = await self.session.execute(stmt)
        models = result.scalars().all()
        return [self._to_entity(model) for model in models]

    async def save(self, token: RefreshToken) -> RefreshToken:
        """Save or update refresh token."""
        stmt = select(RefreshTokenModel).where(RefreshTokenModel.id == token.id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()

        if model:
            model.user_id = token.user_id
            model.token_hash = token.token_hash
            model.jti = token.jti
            model.issued_at = token.issued_at
            model.expires_at = token.expires_at
            model.revoked_at = token.revoked_at
            model.replaced_by_token_id = token.replaced_by_token_id
            model.created_by_ip = token.created_by_ip
            model.user_agent = token.user_agent
        else:
            model = RefreshTokenModel(
                id=token.id,
                user_id=token.user_id,
                token_hash=token.token_hash,
                jti=token.jti,
                issued_at=token.issued_at,
                expires_at=token.expires_at,
                revoked_at=token.revoked_at,
                replaced_by_token_id=token.replaced_by_token_id,
                created_by_ip=token.created_by_ip,
                user_agent=token.user_agent,
            )
            self.session.add(model)

        await self.session.flush()
        await self.session.refresh(model)
        return self._to_entity(model)

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        """Revoke all refresh tokens for a user."""
        from datetime import datetime

        stmt = select(RefreshTokenModel).where(
            RefreshTokenModel.user_id == user_id, RefreshTokenModel.revoked_at.is_(None)
        )
        result = await self.session.execute(stmt)
        tokens = result.scalars().all()

        now = datetime.utcnow()
        for token in tokens:
            if not token.revoked_at:
                token.revoked_at = now

        await self.session.flush()

    def _to_entity(self, model: RefreshTokenModel) -> RefreshToken:
        """Convert RefreshTokenModel to RefreshToken entity."""
        return RefreshToken(
            id=model.id,
            user_id=model.user_id,
            token_hash=model.token_hash,
            jti=model.jti,
            issued_at=model.issued_at,
            expires_at=model.expires_at,
            revoked_at=model.revoked_at,
            replaced_by_token_id=model.replaced_by_token_id,
            created_by_ip=model.created_by_ip,
            user_agent=model.user_agent,
        )

"""
Password Reset Token Repository Implementation

SQLAlchemy implementation of PasswordResetTokenRepository.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.password_reset_token import PasswordResetToken
from src.domain.repositories.password_reset_token_repository import (
    PasswordResetTokenRepository as IPasswordResetTokenRepository,
)
from src.infrastructure.database.models.password_reset_token_model import (
    PasswordResetTokenModel,
)


class PasswordResetTokenRepositoryImpl(IPasswordResetTokenRepository):
    """SQLAlchemy implementation of PasswordResetTokenRepository."""

    def __init__(self, session: AsyncSession):
        """Initialize password reset token repository."""
        self.session = session

    async def find_by_id(self, token_id: UUID) -> Optional[PasswordResetToken]:
        """Find password reset token by ID."""
        stmt = select(PasswordResetTokenModel).where(PasswordResetTokenModel.id == token_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def find_by_token_hash(self, token_hash: str) -> Optional[PasswordResetToken]:
        """Find password reset token by hash."""
        stmt = select(PasswordResetTokenModel).where(
            PasswordResetTokenModel.token_hash == token_hash
        )
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def save(self, token: PasswordResetToken) -> PasswordResetToken:
        """Save or update password reset token."""
        stmt = select(PasswordResetTokenModel).where(PasswordResetTokenModel.id == token.id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()

        if model:
            model.user_id = token.user_id
            model.token_hash = token.token_hash
            model.expires_at = token.expires_at
            model.used_at = token.used_at
            model.created_by_ip = token.created_by_ip
        else:
            model = PasswordResetTokenModel(
                id=token.id,
                user_id=token.user_id,
                token_hash=token.token_hash,
                expires_at=token.expires_at,
                used_at=token.used_at,
                created_at=token.created_at,
                created_by_ip=token.created_by_ip,
            )
            self.session.add(model)

        await self.session.flush()
        await self.session.refresh(model)
        return self._to_entity(model)

    def _to_entity(self, model: PasswordResetTokenModel) -> PasswordResetToken:
        """Convert PasswordResetTokenModel to PasswordResetToken entity."""
        return PasswordResetToken(
            id=model.id,
            user_id=model.user_id,
            token_hash=model.token_hash,
            expires_at=model.expires_at,
            used_at=model.used_at,
            created_at=model.created_at,
            created_by_ip=model.created_by_ip,
        )

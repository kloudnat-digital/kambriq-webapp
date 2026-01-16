"""
User Repository Implementation

SQLAlchemy implementation of UserRepository.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.entities.role import Role
from src.domain.entities.user import User
from src.domain.entities.user_address import UserAddress
from src.domain.repositories.user_repository import UserRepository as IUserRepository
from src.infrastructure.database.models.user_address_model import UserAddressModel
from src.infrastructure.database.models.user_model import UserModel
from src.infrastructure.database.models.user_role_model import UserRoleModel


class UserRepositoryImpl(IUserRepository):
    """SQLAlchemy implementation of UserRepository."""

    def __init__(self, session: AsyncSession):
        """
        Initialize user repository.

        Args:
            session: Async SQLAlchemy session
        """
        self.session = session

    async def find_by_id(self, user_id: UUID) -> Optional[User]:
        """Find user by ID with roles and address loaded."""
        stmt = (
            select(UserModel)
            .options(
                selectinload(UserModel.roles).selectinload(UserRoleModel.role),
                selectinload(UserModel.address),
            )
            .where(UserModel.id == user_id)
        )
        result = await self.session.execute(stmt)
        user_model = result.scalar_one_or_none()

        if not user_model:
            return None

        return self._to_entity(user_model)

    async def find_by_email(self, email: str) -> Optional[User]:
        """Find user by email with roles loaded."""
        stmt = (
            select(UserModel)
            .options(
                selectinload(UserModel.roles).selectinload(UserRoleModel.role),
                selectinload(UserModel.address),
            )
            .where(UserModel.email == email.lower())
        )
        result = await self.session.execute(stmt)
        user_model = result.scalar_one_or_none()

        if not user_model:
            return None

        return self._to_entity(user_model)

    async def save(self, user: User) -> User:
        """Save or update user."""
        # Check if user exists
        stmt = select(UserModel).where(UserModel.id == user.id)
        result = await self.session.execute(stmt)
        user_model = result.scalar_one_or_none()

        if user_model:
            # Update existing
            user_model.first_name = user.first_name
            user_model.last_name = user.last_name
            user_model.email = user.email
            user_model.phone_number = user.phone_number
            user_model.password_hash = user.password_hash
            user_model.referrer_id = user.referrer_id
            user_model.avatar_url = user.avatar_url
            user_model.is_active = user.is_active
            user_model.terms_accepted = user.terms_accepted
            user_model.updated_at = user.updated_at

            # Update address if provided
            if user.address:
                if user_model.address:
                    addr_model = user_model.address
                else:
                    addr_model = UserAddressModel(user_id=user.id)
                    self.session.add(addr_model)

                addr_model.line = user.address.line
                addr_model.complement = user.address.complement
                addr_model.postal_code = user.address.postal_code
                addr_model.city = user.address.city
                addr_model.country = user.address.country
        else:
            # Create new
            user_model = UserModel(
                id=user.id,
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email,
                phone_number=user.phone_number,
                password_hash=user.password_hash,
                referrer_id=user.referrer_id,
                avatar_url=user.avatar_url,
                is_active=user.is_active,
                terms_accepted=user.terms_accepted,
                created_at=user.created_at,
                updated_at=user.updated_at,
            )
            self.session.add(user_model)

            # Add address if provided
            if user.address:
                addr_model = UserAddressModel(
                    user_id=user.id,
                    line=user.address.line,
                    complement=user.address.complement,
                    postal_code=user.address.postal_code,
                    city=user.address.city,
                    country=user.address.country,
                )
                self.session.add(addr_model)

        await self.session.flush()
        await self.session.refresh(user_model)

        # Reload with roles
        saved_user = await self.find_by_id(user.id)
        if not saved_user:
            raise ValueError(f"User with ID {user.id} not found after save")
        return saved_user

    async def exists_by_email(self, email: str) -> bool:
        """Check if user exists by email."""
        stmt = select(UserModel).where(UserModel.email == email.lower())
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    def _to_entity(self, user_model: UserModel) -> User:
        """Convert UserModel to User entity."""
        # Load address
        address = None
        if user_model.address:
            address = UserAddress(
                line=user_model.address.line,
                complement=user_model.address.complement,
                postal_code=user_model.address.postal_code,
                city=user_model.address.city,
                country=user_model.address.country,
            )

        # Load roles
        roles: List[Role] = []
        for user_role in user_model.roles:
            role_model = user_role.role
            roles.append(
                Role(
                    id=role_model.id,
                    name=role_model.name,
                    created_at=role_model.created_at,
                    updated_at=role_model.updated_at,
                )
            )

        # Create User entity
        user = User(
            id=user_model.id,
            first_name=user_model.first_name,
            last_name=user_model.last_name,
            email=user_model.email,
            phone_number=user_model.phone_number,
            address=address,
            password_hash=user_model.password_hash,
            referrer_id=user_model.referrer_id,
            avatar_url=user_model.avatar_url,
            is_active=user_model.is_active,
            terms_accepted=user_model.terms_accepted,
            created_at=user_model.created_at,
            updated_at=user_model.updated_at,
        )
        # Add roles as dynamic attribute (User entity doesn't have roles in domain)
        # This allows use cases to access roles when needed
        user.roles = roles  # type: ignore[attr-defined]
        return user

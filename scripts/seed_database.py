#!/usr/bin/env python3
"""
Seed Database Script

Idempotent database seeding script.
Executes seed for roles, resources, permissions, and admin user.

Usage:
    python scripts/seed_database.py
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from passlib.context import CryptContext  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.infrastructure.seed.seed_data import (  # noqa: E402
    RESOURCE_ACTIONS,
    RESOURCES,
    ROLES,
)
from src.infrastructure.seed.seed_repository import SeedRepository  # noqa: E402

# Password hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_database_url() -> str:
    """
    Get database URL from environment variable.

    Returns:
        Database URL string
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError(
            "DATABASE_URL environment variable is required. "
            "Example: postgresql+asyncpg://user:password@localhost:5432/dbname"
        )
    return database_url


async def execute_seed(session: AsyncSession):
    """
    Execute the seeding logic.

    Args:
        session: AsyncSession to use for database operations
    """
    seed_repo = SeedRepository(session)

    # 1. Seed Roles
    print("\n📝 Seeding roles...")
    roles_map = {}
    for role_name in ROLES:
        role = await seed_repo.upsert_role(role_name)
        roles_map[role_name] = role
        print(f"  ✅ Role: {role_name}")

    # 2. Seed Resources
    print("\n📝 Seeding resources...")
    resources_map = {}
    for resource_name in RESOURCES:
        resource = await seed_repo.upsert_resource(resource_name)
        resources_map[resource_name] = resource
        print(f"  ✅ Resource: {resource_name}")

        # 3. Seed Permissions (matrice: role x resource)
    print("\n📝 Seeding permissions (matrice)...")
    permission_count = 0

    for role_name, role in roles_map.items():
        for resource_name, resource in resources_map.items():
            # Get actions for this resource
            resource_actions = seed_repo.get_resource_actions(resource_name)

            # Build action_permissions dict
            action_permissions = {}

            # For admin_global: all actions = True for all resources
            if role_name == "admin_global":
                # Set ALL actions to True (all 36 actions)
                all_actions = []
                for actions_list in RESOURCE_ACTIONS.values():
                    all_actions.extend(actions_list)

                for action in all_actions:
                    action_permissions[action] = True
            else:
                # For other roles: only actions of the current resource = True
                for action in resource_actions:
                    action_permissions[action] = True

            # Create/update permission
            await seed_repo.upsert_permission(
                role_id=role.id,
                resource_id=resource.id,
                action_permissions=action_permissions,
            )
            permission_count += 1

    print(f"  ✅ Created/updated {permission_count} permission entries")

    # 4. Seed Admin User
    print("\n📝 Seeding admin user...")
    admin_password_hash = pwd_context.hash("contact12345")
    admin_user = await seed_repo.upsert_user(
        email="contact@kambriq.com",
        first_name="Contact",
        last_name="Contact",
        password_hash=admin_password_hash,
        phone_number="661234567",
        is_active=True,
        terms_accepted=True,
    )
    print(f"  ✅ Admin user: {admin_user.email}")

    # 5. Assign admin_global role to admin user
    admin_global_role = roles_map.get("admin_global")
    if admin_global_role:
        await seed_repo.upsert_user_role(user_id=admin_user.id, role_id=admin_global_role.id)
        print(f"  ✅ Assigned role 'admin_global' to {admin_user.email}")

    # Print summary
    print("\n✅ Database seed completed successfully!")
    print(f"   - {len(roles_map)} roles")
    print(f"   - {len(resources_map)} resources")
    print(f"   - {permission_count} permission entries")
    print("   - 1 admin user")

    return {
        "roles": len(roles_map),
        "resources": len(resources_map),
        "permissions": permission_count,
    }


async def seed_database(session: Optional[AsyncSession] = None):
    """
    Execute database seeding.

    Args:
        session: Optional AsyncSession. If provided, uses it instead of creating a new one.
    """
    if session is None:
        database_url = get_database_url()

        print("🌱 Starting database seed...")
        print(f"📊 Database URL: {database_url.split('@')[-1]}")  # Hide credentials

        # Create engine and session
        engine = create_async_engine(database_url, echo=False)
        async_session = async_sessionmaker(engine, expire_on_commit=False)

        async with async_session() as session:
            try:
                await execute_seed(session)
                await session.commit()
            except Exception as e:
                await session.rollback()
                print(f"\n❌ Error during seed: {e}")
                raise

        await engine.dispose()
    else:
        # Use provided session
        try:
            await execute_seed(session)
        except Exception as e:
            print(f"\n❌ Error during seed: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(seed_database())

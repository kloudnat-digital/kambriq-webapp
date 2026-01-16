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
from uuid import UUID

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

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
    for role_name, role_id in ROLES.items():
        role = await seed_repo.upsert_role(role_name, role_id=role_id)
        roles_map[role_name] = role
        print(f"  ✅ Role: {role_name} (ID: {role.id})")

    # 2. Seed Resources
    print("\n📝 Seeding resources...")
    resources_map = {}
    for resource_name, resource_id in RESOURCES.items():
        resource = await seed_repo.upsert_resource(resource_name, resource_id=resource_id)
        resources_map[resource_name] = resource
        print(f"  ✅ Resource: {resource_name} (ID: {resource.id})")

        # 3. Seed Permissions (matrice: role x resource)
    print("\n📝 Seeding permissions (matrice)...")
    permission_count = 0

    for _role_name, role in roles_map.items():
        for resource_name, resource in resources_map.items():
            # Get actions for this resource
            resource_actions = seed_repo.get_resource_actions(resource_name)

            # Build action_permissions dict
            action_permissions = {}

            # For admin_global role (ID: 00000000-0000-0000-0000-00000000000c): all actions = True for all resources
            admin_global_role_id = ROLES.get("admin_global")
            if admin_global_role_id and role.id == admin_global_role_id:
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

    # 4. Seed Admin User (Contact)
    print("\n📝 Seeding admin user (contact)...")
    # Get contact user data from environment variables (REQUIRED - no defaults)
    contact_email = os.getenv("SEED_CONTACT_EMAIL")
    contact_password = os.getenv("SEED_CONTACT_PASSWORD")
    contact_first_name = os.getenv("SEED_CONTACT_FIRST_NAME")
    contact_last_name = os.getenv("SEED_CONTACT_LAST_NAME")
    contact_phone = os.getenv("SEED_CONTACT_PHONE")

    if not contact_email:
        raise ValueError("SEED_CONTACT_EMAIL environment variable is required")
    if not contact_password:
        raise ValueError("SEED_CONTACT_PASSWORD environment variable is required")
    if not contact_first_name:
        raise ValueError("SEED_CONTACT_FIRST_NAME environment variable is required")
    if not contact_last_name:
        raise ValueError("SEED_CONTACT_LAST_NAME environment variable is required")
    if not contact_phone:
        raise ValueError("SEED_CONTACT_PHONE environment variable is required")

    # Hash the password using bcrypt directly (avoid passlib bug detection issue)
    import bcrypt

    contact_password_hash = bcrypt.hashpw(
        contact_password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    admin_user = await seed_repo.upsert_user(
        email=contact_email,
        first_name=contact_first_name,
        last_name=contact_last_name,
        password_hash=contact_password_hash,
        phone_number=contact_phone,
        is_active=True,
        terms_accepted=True,
    )
    print(f"  ✅ Admin user: {admin_user.email}")

    # 5. Assign role to admin user (using role ID from environment - REQUIRED)
    contact_role_id_str = os.getenv("SEED_CONTACT_ROLE_ID")
    if not contact_role_id_str:
        raise ValueError("SEED_CONTACT_ROLE_ID environment variable is required")

    try:
        contact_role_id = UUID(contact_role_id_str)
        # Find role by ID
        admin_global_role = None
        for role in roles_map.values():
            if role.id == contact_role_id:
                admin_global_role = role
                break
        if not admin_global_role:
            raise ValueError(f"Role with ID {contact_role_id} not found")
    except ValueError as e:
        raise ValueError(f"Invalid SEED_CONTACT_ROLE_ID: {e}") from e

    await seed_repo.upsert_user_role(user_id=admin_user.id, role_id=admin_global_role.id)
    print(
        f"  ✅ Assigned role '{admin_global_role.name}' (ID: {admin_global_role.id}) to {admin_user.email}"
    )

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

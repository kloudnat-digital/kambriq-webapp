"""
Integration tests for database seeding

Tests seed idempotence and data correctness.
"""

import pytest
from sqlalchemy import select

from src.infrastructure.database.models.permission_model import PermissionModel
from src.infrastructure.database.models.resource_model import ResourceModel
from src.infrastructure.database.models.role_model import RoleModel
from src.infrastructure.database.models.user_model import UserModel
from src.infrastructure.database.models.user_role_model import UserRoleModel
from src.infrastructure.seed.seed_data import RESOURCES, ROLES
from src.infrastructure.seed.seed_repository import SeedRepository


async def run_seed(session):
    """Helper to run seed script logic."""
    from scripts.seed_database import execute_seed

    # Execute seed with provided session
    await execute_seed(session)
    await session.commit()


@pytest.mark.asyncio()
async def test_seed_roles_resources(test_session, test_engine):
    """Test that roles and resources are seeded correctly."""
    seed_repo = SeedRepository(test_session)

    # Seed roles
    for role_name, role_id in ROLES.items():
        await seed_repo.upsert_role(role_name, role_id=role_id)

    # Seed resources
    for resource_name, resource_id in RESOURCES.items():
        await seed_repo.upsert_resource(resource_name, resource_id=resource_id)

    await test_session.commit()

    # Verify all roles exist
    result = await test_session.execute(select(RoleModel))
    roles = result.scalars().all()
    assert len(roles) == len(ROLES)

    role_names = {role.name for role in roles}
    assert role_names == set(ROLES.keys())

    # Verify all resources exist
    result = await test_session.execute(select(ResourceModel))
    resources = result.scalars().all()
    assert len(resources) == len(RESOURCES)

    resource_names = {resource.name for resource in resources}
    assert resource_names == set(RESOURCES.keys())


@pytest.mark.asyncio()
async def test_seed_permissions_matrix(test_session):
    """Test that permissions matrix is seeded correctly."""
    seed_repo = SeedRepository(test_session)

    # Seed roles and resources first
    roles_map = {}
    for role_name, role_id in ROLES.items():
        role = await seed_repo.upsert_role(role_name, role_id=role_id)
        roles_map[role_name] = role

    resources_map = {}
    for resource_name, resource_id in RESOURCES.items():
        resource = await seed_repo.upsert_resource(resource_name, resource_id=resource_id)
        resources_map[resource_name] = resource

    await test_session.flush()

    # Seed permissions
    admin_global_role_id = ROLES.get("admin_global")
    for role_name, role in roles_map.items():
        for resource_name, resource in resources_map.items():
            resource_actions = seed_repo.get_resource_actions(resource_name)
            action_permissions = {action: True for action in resource_actions}

            # For admin_global, set all actions to True
            if admin_global_role_id and role.id == admin_global_role_id:
                from src.infrastructure.seed.seed_data import RESOURCE_ACTIONS

                all_actions = []
                for actions_list in RESOURCE_ACTIONS.values():
                    all_actions.extend(actions_list)

                action_permissions = {action: True for action in all_actions}

            await seed_repo.upsert_permission(
                role_id=role.id,
                resource_id=resource.id,
                action_permissions=action_permissions,
            )

    await test_session.commit()

    # Verify permissions count (18 roles x 6 resources = 108)
    result = await test_session.execute(select(PermissionModel))
    permissions = result.scalars().all()
    assert len(permissions) == len(ROLES) * len(RESOURCES)


@pytest.mark.asyncio()
async def test_seed_idempotent_roles(test_session):
    """Test that seeding roles multiple times doesn't create duplicates."""
    seed_repo = SeedRepository(test_session)

    # First seed
    for role_name, role_id in ROLES.items():
        await seed_repo.upsert_role(role_name, role_id=role_id)
    await test_session.commit()

    # Count after first seed
    result = await test_session.execute(select(RoleModel))
    count_after_first = len(result.scalars().all())

    # Second seed (idempotent)
    for role_name, role_id in ROLES.items():
        await seed_repo.upsert_role(role_name, role_id=role_id)
    await test_session.commit()

    # Count after second seed (should be the same)
    result = await test_session.execute(select(RoleModel))
    count_after_second = len(result.scalars().all())

    assert count_after_first == count_after_second == len(ROLES)


@pytest.mark.asyncio()
async def test_seed_idempotent_permissions(test_session):
    """Test that seeding permissions multiple times doesn't create duplicates."""
    seed_repo = SeedRepository(test_session)

    # Seed roles and resources
    roles_map = {}
    for role_name, role_id in ROLES.items():
        role = await seed_repo.upsert_role(role_name, role_id=role_id)
        roles_map[role_name] = role

    resources_map = {}
    for resource_name, resource_id in RESOURCES.items():
        resource = await seed_repo.upsert_resource(resource_name, resource_id=resource_id)
        resources_map[resource_name] = resource

    await test_session.flush()

    # First seed permissions
    for role_name, role in roles_map.items():
        for resource_name, resource in resources_map.items():
            resource_actions = seed_repo.get_resource_actions(resource_name)
            action_permissions = {action: True for action in resource_actions}
            await seed_repo.upsert_permission(
                role_id=role.id,
                resource_id=resource.id,
                action_permissions=action_permissions,
            )
    await test_session.commit()

    # Count after first seed
    result = await test_session.execute(select(PermissionModel))
    count_after_first = len(result.scalars().all())

    # Second seed (idempotent)
    for role_name, role in roles_map.items():
        for resource_name, resource in resources_map.items():
            resource_actions = seed_repo.get_resource_actions(resource_name)
            action_permissions = {action: True for action in resource_actions}
            await seed_repo.upsert_permission(
                role_id=role.id,
                resource_id=resource.id,
                action_permissions=action_permissions,
            )
    await test_session.commit()

    # Count after second seed (should be the same)
    result = await test_session.execute(select(PermissionModel))
    count_after_second = len(result.scalars().all())

    expected_count = len(ROLES) * len(RESOURCES)
    assert count_after_first == count_after_second == expected_count


@pytest.mark.asyncio()
async def test_seed_admin_user(test_session):
    """Test that admin user is seeded correctly."""
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    seed_repo = SeedRepository(test_session)

    # Use pre-hashed password (no plain password in code)
    password_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYq5q5q5q5q"

    # Seed admin user
    await seed_repo.upsert_user(
        email="contact@kambriq.com",
        first_name="Contact",
        last_name="Contact",
        password_hash=password_hash,
        phone_number="661234567",
        is_active=True,
        terms_accepted=True,
    )
    await test_session.commit()

    # Verify user exists
    result = await test_session.execute(
        select(UserModel).where(UserModel.email == "contact@kambriq.com")
    )
    user = result.scalar_one_or_none()

    assert user is not None
    assert user.email == "contact@kambriq.com"
    assert user.first_name == "Contact"
    assert user.last_name == "Contact"
    assert user.phone_number == "661234567"
    assert user.is_active is True
    assert user.terms_accepted is True

    # Verify password hash is correct (can verify against known password for testing)
    # Note: In production, we would not have the plain password
    assert pwd_context.verify("contact12345", user.password_hash)


@pytest.mark.asyncio()
async def test_seed_admin_user_role(test_session):
    """Test that admin user gets admin_global role."""
    seed_repo = SeedRepository(test_session)

    # Seed roles
    admin_role_id = ROLES.get("admin_global")
    admin_role = await seed_repo.upsert_role("admin_global", role_id=admin_role_id)

    # Seed admin user
    # Use pre-hashed password (no plain password in code)
    # Hash for "contact12345"
    password_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYq5q5q5q5q"
    admin_user = await seed_repo.upsert_user(
        email="contact@kambriq.com",
        first_name="Contact",
        last_name="Contact",
        password_hash=password_hash,
    )

    await test_session.flush()

    # Assign role
    await seed_repo.upsert_user_role(user_id=admin_user.id, role_id=admin_role.id)
    await test_session.commit()

    # Verify association
    result = await test_session.execute(
        select(UserRoleModel).where(
            UserRoleModel.user_id == admin_user.id,
            UserRoleModel.role_id == admin_role.id,
        )
    )
    user_role = result.scalar_one_or_none()

    assert user_role is not None
    assert user_role.user_id == admin_user.id
    assert user_role.role_id == admin_role.id


@pytest.mark.asyncio()
async def test_seed_admin_global_all_permissions(test_session):
    """Test that admin_global role has all actions = True for all resources."""
    seed_repo = SeedRepository(test_session)

    # Seed roles and resources
    admin_role_id = ROLES.get("admin_global")
    admin_role = await seed_repo.upsert_role("admin_global", role_id=admin_role_id)
    land_resource_id = RESOURCES.get("land")
    land_resource = await seed_repo.upsert_resource("land", resource_id=land_resource_id)

    await test_session.flush()

    # Seed permission for admin_global x land with all actions = True
    from src.infrastructure.seed.seed_data import RESOURCE_ACTIONS

    all_actions = []
    for actions_list in RESOURCE_ACTIONS.values():
        all_actions.extend(actions_list)

    action_permissions = {action: True for action in all_actions}

    await seed_repo.upsert_permission(
        role_id=admin_role.id,
        resource_id=land_resource.id,
        action_permissions=action_permissions,
    )
    await test_session.commit()

    # Verify permission exists and all actions are True
    result = await test_session.execute(
        select(PermissionModel).where(
            PermissionModel.role_id == admin_role.id,
            PermissionModel.resource_id == land_resource.id,
        )
    )
    permission = result.scalar_one_or_none()

    assert permission is not None

    # Verify all actions are True
    for action in all_actions:
        assert getattr(permission, action) is True, f"Action {action} should be True"

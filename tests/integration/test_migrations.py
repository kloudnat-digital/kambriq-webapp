"""
Integration tests for Alembic migrations

Tests upgrade, downgrade, and re-upgrade cycles.
"""

# Use SQLite for testing migrations
import os

import pytest
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from alembic.config import Config

TEST_DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@postgres:5432/kambriq_db"
)


@pytest.fixture()
def alembic_cfg():
    """Create Alembic config for testing."""
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    return alembic_cfg


@pytest.fixture()
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    yield engine
    await engine.dispose()


@pytest.mark.asyncio()
async def test_migration_upgrade(alembic_cfg, test_engine):
    """Test that upgrade creates all tables."""
    # Run upgrade to head
    command.upgrade(alembic_cfg, "head")

    # Verify all tables exist
    async with test_engine.connect():
        inspector = inspect(test_engine.sync_engine)
        tables = inspector.get_table_names()

        expected_tables = [
            "users",
            "user_addresses",
            "roles",
            "resources",
            "user_roles",
            "permissions",
            "refresh_tokens",
            "password_reset_tokens",
        ]

        for table in expected_tables:
            assert table in tables, f"Table {table} should exist after migration"

    # Verify permissions table has all 36 action columns
    async with test_engine.connect() as _conn:
        inspector = inspect(test_engine.sync_engine)
        columns = [col["name"] for col in inspector.get_columns("permissions")]

        # Check all LAND actions
        assert "land_view_public_lands" in columns
        assert "land_view_agents_catalog" in columns
        assert "land_view_agent_land_detail" in columns
        assert "land_upsert_land" in columns
        assert "land_assign_label_tdt_vefil_vefl" in columns
        assert "land_reserve_land" in columns
        assert "land_validate_reservation" in columns

        # Check all VERIFY actions
        assert "verify_submit_case" in columns
        assert "verify_view_own_results" in columns
        assert "verify_process_request" in columns
        assert "verify_generate_documents" in columns
        assert "verify_rate_case_compliant" in columns

        # Check all KBS actions
        assert "kbs_view_kbs_presentation" in columns
        assert "kbs_signup" in columns
        assert "kbs_access_courses" in columns
        assert "kbs_take_exam" in columns
        assert "kbs_view_kca_certificate" in columns
        assert "kbs_manage_contents" in columns
        assert "kbs_manage_candidates" in columns

        # Check all KAMNET actions
        assert "kamnet_view_land_catalog" in columns
        assert "kamnet_reserve_land" in columns
        assert "kamnet_view_referrals_n1" in columns
        assert "kamnet_view_referrals_n1_n2_n3" in columns
        assert "kamnet_view_personal_network" in columns
        assert "kamnet_manage_agents" in columns
        assert "kamnet_create_agent" in columns

        # Check all PARTNER actions
        assert "partner_create" in columns
        assert "partner_read" in columns
        assert "partner_update" in columns
        assert "partner_delete" in columns
        assert "partner_export" in columns

        # Check all ADMINISTRATEUR actions
        assert "administrateur_create" in columns
        assert "administrateur_read" in columns
        assert "administrateur_update" in columns
        assert "administrateur_delete" in columns
        assert "administrateur_export" in columns

        # Count action columns (should be 36)
        action_columns = [
            col
            for col in columns
            if not col.endswith("_id") and col not in ["id", "created_at", "updated_at"]
        ]
        assert (
            len(action_columns) == 36
        ), f"Should have 36 action columns, got {len(action_columns)}"


@pytest.mark.asyncio()
async def test_migration_downgrade(alembic_cfg, test_engine):
    """Test that downgrade removes all tables."""
    # First upgrade
    command.upgrade(alembic_cfg, "head")

    # Verify tables exist
    async with test_engine.connect():
        inspector = inspect(test_engine.sync_engine)
        tables_before = inspector.get_table_names()
        assert len(tables_before) > 0

    # Downgrade to base
    command.downgrade(alembic_cfg, "base")

    # Verify all tables are removed
    async with test_engine.connect() as _conn:
        inspector = inspect(test_engine.sync_engine)
        tables_after = inspector.get_table_names()

        expected_tables = [
            "users",
            "user_addresses",
            "roles",
            "resources",
            "user_roles",
            "permissions",
            "refresh_tokens",
            "password_reset_tokens",
        ]

        for table in expected_tables:
            assert table not in tables_after, f"Table {table} should not exist after downgrade"


@pytest.mark.asyncio()
async def test_migration_re_upgrade(alembic_cfg, test_engine):
    """Test that re-upgrade after downgrade works (idempotence)."""
    # Upgrade
    command.upgrade(alembic_cfg, "head")

    # Downgrade
    command.downgrade(alembic_cfg, "base")

    # Re-upgrade
    command.upgrade(alembic_cfg, "head")

    # Verify tables exist again
    async with test_engine.connect() as _conn:
        inspector = inspect(test_engine.sync_engine)
        tables = inspector.get_table_names()

        expected_tables = [
            "users",
            "user_addresses",
            "roles",
            "resources",
            "user_roles",
            "permissions",
            "refresh_tokens",
            "password_reset_tokens",
        ]

        for table in expected_tables:
            assert table in tables, f"Table {table} should exist after re-upgrade"


@pytest.mark.asyncio()
async def test_permissions_unique_constraint(alembic_cfg, test_engine):
    """Test that permissions table has unique constraint on (role_id, resource_id)."""
    command.upgrade(alembic_cfg, "head")

    async with test_engine.connect() as _conn:
        inspector = inspect(test_engine.sync_engine)
        constraints = inspector.get_unique_constraints("permissions")

        # Find the unique constraint on role_id and resource_id
        unique_constraint = None
        for constraint in constraints:
            if set(constraint["column_names"]) == {"role_id", "resource_id"}:
                unique_constraint = constraint
                break

        assert (
            unique_constraint is not None
        ), "Unique constraint on (role_id, resource_id) should exist"


@pytest.mark.asyncio()
async def test_user_email_unique_constraint(alembic_cfg, test_engine):
    """Test that users table has unique constraint on email."""
    command.upgrade(alembic_cfg, "head")

    async with test_engine.connect() as _conn:
        inspector = inspect(test_engine.sync_engine)
        constraints = inspector.get_unique_constraints("users")

        # Find unique constraint on email
        email_unique = None
        for constraint in constraints:
            if "email" in constraint["column_names"]:
                email_unique = constraint
                break

        assert email_unique is not None, "Unique constraint on email should exist"

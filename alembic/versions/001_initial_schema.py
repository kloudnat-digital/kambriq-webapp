"""Initial schema: users, roles, resources, permissions, etc

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-01-28 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(255), nullable=False),
        sa.Column("last_name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("phone_number", sa.String(50), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("referrer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("terms_accepted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["referrer_id"], ["users.id"], name="users_referrer_id_fkey"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    # Create user_addresses table
    op.create_table(
        "user_addresses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("line", sa.String(500), nullable=False),
        sa.Column("complement", sa.String(500), nullable=True),
        sa.Column("postal_code", sa.String(50), nullable=False),
        sa.Column("city", sa.String(255), nullable=False),
        sa.Column("country", sa.String(255), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="user_addresses_user_id_fkey", ondelete="CASCADE"
        ),
    )

    # Create roles table
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_roles_name", "roles", ["name"], unique=False)

    # Create resources table
    op.create_table(
        "resources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_resources_name", "resources", ["name"], unique=False)

    # Create user_roles table (association)
    op.create_table(
        "user_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="user_roles_user_id_fkey", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["role_id"], ["roles.id"], name="user_roles_role_id_fkey", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["assigned_by"], ["users.id"], name="user_roles_assigned_by_fkey", ondelete="SET NULL"
        ),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_roles_user_role"),
    )

    # Create permissions table (matrice format)
    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=False),
        # LAND actions (7)
        sa.Column("land_view_public_lands", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("land_view_agents_catalog", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "land_view_agent_land_detail", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column("land_upsert_land", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "land_assign_label_tdt_vefil_vefl", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column("land_reserve_land", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "land_validate_reservation", sa.Boolean(), nullable=False, server_default="false"
        ),
        # VERIFY actions (5)
        sa.Column("verify_submit_case", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("verify_view_own_results", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("verify_process_request", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "verify_generate_documents", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column(
            "verify_rate_case_compliant", sa.Boolean(), nullable=False, server_default="false"
        ),
        # KBS actions (7)
        sa.Column(
            "kbs_view_kbs_presentation", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column("kbs_signup", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kbs_access_courses", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kbs_take_exam", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kbs_view_kca_certificate", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kbs_manage_contents", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kbs_manage_candidates", sa.Boolean(), nullable=False, server_default="false"),
        # KAMNET actions (7)
        sa.Column("kamnet_view_land_catalog", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kamnet_reserve_land", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kamnet_view_referrals_n1", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "kamnet_view_referrals_n1_n2_n3", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column(
            "kamnet_view_personal_network", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column("kamnet_manage_agents", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kamnet_create_agent", sa.Boolean(), nullable=False, server_default="false"),
        # PARTNER actions (5)
        sa.Column("partner_create", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("partner_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("partner_update", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("partner_delete", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("partner_export", sa.Boolean(), nullable=False, server_default="false"),
        # ADMINISTRATEUR actions (5)
        sa.Column("administrateur_create", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("administrateur_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("administrateur_update", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("administrateur_delete", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("administrateur_export", sa.Boolean(), nullable=False, server_default="false"),
        # Metadata
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["role_id"], ["roles.id"], name="permissions_role_id_fkey", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["resource_id"],
            ["resources.id"],
            name="permissions_resource_id_fkey",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("role_id", "resource_id", name="uq_permissions_role_resource"),
    )

    # Create refresh_tokens table
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("jti", sa.String(255), nullable=False, unique=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by_token_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_ip", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="refresh_tokens_user_id_fkey", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["replaced_by_token_id"],
            ["refresh_tokens.id"],
            name="refresh_tokens_replaced_by_token_id_fkey",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"], unique=False)
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=False)
    op.create_index("ix_refresh_tokens_jti", "refresh_tokens", ["jti"], unique=False)
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"], unique=False)
    op.create_index(
        "ix_refresh_tokens_user_active",
        "refresh_tokens",
        ["user_id", "revoked_at", "expires_at"],
        unique=False,
    )

    # Create password_reset_tokens table
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_ip", sa.String(45), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="password_reset_tokens_user_id_fkey",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"], unique=False
    )
    op.create_index(
        "ix_password_reset_tokens_token_hash",
        "password_reset_tokens",
        ["token_hash"],
        unique=False,
    )
    op.create_index(
        "ix_password_reset_tokens_expires_at",
        "password_reset_tokens",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        "ix_password_reset_tokens_active",
        "password_reset_tokens",
        ["user_id", "used_at", "expires_at"],
        unique=False,
    )


def downgrade() -> None:
    # Drop tables in reverse order (respecting foreign key dependencies)
    op.drop_index("ix_password_reset_tokens_active", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_expires_at", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_token_hash", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_user_id", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")

    op.drop_index("ix_refresh_tokens_user_active", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_expires_at", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_jti", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_table("permissions")

    op.drop_table("user_roles")

    op.drop_index("ix_resources_name", table_name="resources")
    op.drop_table("resources")

    op.drop_index("ix_roles_name", table_name="roles")
    op.drop_table("roles")

    op.drop_table("user_addresses")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

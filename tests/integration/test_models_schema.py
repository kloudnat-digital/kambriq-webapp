"""
Integration tests for SQLAlchemy models

Tests database schema, constraints, and relationships.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from src.infrastructure.database.models.permission_model import PermissionModel
from src.infrastructure.database.models.password_reset_token_model import PasswordResetTokenModel
from src.infrastructure.database.models.refresh_token_model import RefreshTokenModel
from src.infrastructure.database.models.resource_model import ResourceModel
from src.infrastructure.database.models.role_model import RoleModel
from src.infrastructure.database.models.user_address_model import UserAddressModel
from src.infrastructure.database.models.user_model import UserModel
from src.infrastructure.database.models.user_role_model import UserRoleModel


class TestUserModel:
    """Test UserModel schema and constraints."""
    
    @pytest.mark.asyncio
    async def test_create_user(self, test_session):
        """Test creating a user."""
        user = UserModel(
            id=uuid4(),
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            password_hash="hashed_password",
            is_active=True,
            terms_accepted=False,
        )
        
        test_session.add(user)
        await test_session.commit()
        
        # Verify user was created
        result = await test_session.get(UserModel, user.id)
        assert result is not None
        assert result.email == "john.doe@example.com"
        assert result.is_active is True
    
    @pytest.mark.asyncio
    async def test_user_email_unique_constraint(self, test_session):
        """Test that email must be unique."""
        email = "duplicate@example.com"
        
        user1 = UserModel(
            id=uuid4(),
            first_name="User",
            last_name="One",
            email=email,
            password_hash="hash1",
        )
        
        user2 = UserModel(
            id=uuid4(),
            first_name="User",
            last_name="Two",
            email=email,  # Duplicate email
            password_hash="hash2",
        )
        
        test_session.add(user1)
        await test_session.commit()
        
        test_session.add(user2)
        with pytest.raises(Exception):  # IntegrityError
            await test_session.commit()


class TestRoleModel:
    """Test RoleModel schema."""
    
    @pytest.mark.asyncio
    async def test_create_role(self, test_session):
        """Test creating a role."""
        role = RoleModel(
            id=uuid4(),
            name="admin",
        )
        
        test_session.add(role)
        await test_session.commit()
        
        result = await test_session.get(RoleModel, role.id)
        assert result is not None
        assert result.name == "admin"
    
    @pytest.mark.asyncio
    async def test_role_name_unique_constraint(self, test_session):
        """Test that role name must be unique."""
        name = "duplicate_role"
        
        role1 = RoleModel(id=uuid4(), name=name)
        role2 = RoleModel(id=uuid4(), name=name)
        
        test_session.add(role1)
        await test_session.commit()
        
        test_session.add(role2)
        with pytest.raises(Exception):  # IntegrityError
            await test_session.commit()


class TestResourceModel:
    """Test ResourceModel schema."""
    
    @pytest.mark.asyncio
    async def test_create_resource(self, test_session):
        """Test creating a resource."""
        resource = ResourceModel(
            id=uuid4(),
            name="land",
        )
        
        test_session.add(resource)
        await test_session.commit()
        
        result = await test_session.get(ResourceModel, resource.id)
        assert result is not None
        assert result.name == "land"
    
    @pytest.mark.asyncio
    async def test_resource_name_unique_constraint(self, test_session):
        """Test that resource name must be unique."""
        name = "duplicate_resource"
        
        resource1 = ResourceModel(id=uuid4(), name=name)
        resource2 = ResourceModel(id=uuid4(), name=name)
        
        test_session.add(resource1)
        await test_session.commit()
        
        test_session.add(resource2)
        with pytest.raises(Exception):  # IntegrityError
            await test_session.commit()


class TestPermissionModel:
    """Test PermissionModel (matrice format)."""
    
    @pytest.mark.asyncio
    async def test_create_permission_matrix(self, test_session):
        """Test creating a permission matrix entry."""
        role = RoleModel(id=uuid4(), name="test_role")
        resource = ResourceModel(id=uuid4(), name="land")
        
        test_session.add(role)
        test_session.add(resource)
        await test_session.flush()
        
        permission = PermissionModel(
            id=uuid4(),
            role_id=role.id,
            resource_id=resource.id,
            land_view_public_lands=True,
            land_reserve_land=True,
        )
        
        test_session.add(permission)
        await test_session.commit()
        
        result = await test_session.get(PermissionModel, permission.id)
        assert result is not None
        assert result.land_view_public_lands is True
        assert result.land_reserve_land is True
        # Other actions should default to False
        assert result.verify_submit_case is False
        assert result.kbs_access_courses is False
    
    @pytest.mark.asyncio
    async def test_permission_unique_constraint(self, test_session):
        """Test that (role_id, resource_id) must be unique."""
        role = RoleModel(id=uuid4(), name="test_role")
        resource = ResourceModel(id=uuid4(), name="land")
        
        test_session.add(role)
        test_session.add(resource)
        await test_session.flush()
        
        perm1 = PermissionModel(
            id=uuid4(),
            role_id=role.id,
            resource_id=resource.id,
        )
        
        perm2 = PermissionModel(
            id=uuid4(),
            role_id=role.id,
            resource_id=resource.id,  # Duplicate combination
        )
        
        test_session.add(perm1)
        await test_session.commit()
        
        test_session.add(perm2)
        with pytest.raises(Exception):  # IntegrityError
            await test_session.commit()
    
    @pytest.mark.asyncio
    async def test_all_permission_actions_exist(self, test_session):
        """Test that all 36 action columns exist."""
        role = RoleModel(id=uuid4(), name="test_role")
        resource = ResourceModel(id=uuid4(), name="test_resource")
        
        test_session.add(role)
        test_session.add(resource)
        await test_session.flush()
        
        permission = PermissionModel(
            id=uuid4(),
            role_id=role.id,
            resource_id=resource.id,
        )
        
        # Verify all action columns exist
        action_columns = [
            # LAND (7)
            "land_view_public_lands",
            "land_view_agents_catalog",
            "land_view_agent_land_detail",
            "land_upsert_land",
            "land_assign_label_tdt_vefil_vefl",
            "land_reserve_land",
            "land_validate_reservation",
            # VERIFY (5)
            "verify_submit_case",
            "verify_view_own_results",
            "verify_process_request",
            "verify_generate_documents",
            "verify_rate_case_compliant",
            # KBS (7)
            "kbs_view_kbs_presentation",
            "kbs_signup",
            "kbs_access_courses",
            "kbs_take_exam",
            "kbs_view_kca_certificate",
            "kbs_manage_contents",
            "kbs_manage_candidates",
            # KAMNET (7)
            "kamnet_view_land_catalog",
            "kamnet_reserve_land",
            "kamnet_view_referrals_n1",
            "kamnet_view_referrals_n1_n2_n3",
            "kamnet_view_personal_network",
            "kamnet_manage_agents",
            "kamnet_create_agent",
            # PARTNER (5)
            "partner_create",
            "partner_read",
            "partner_update",
            "partner_delete",
            "partner_export",
            # ADMINISTRATEUR (5)
            "administrateur_create",
            "administrateur_read",
            "administrateur_update",
            "administrateur_delete",
            "administrateur_export",
        ]
        
        for action in action_columns:
            assert hasattr(permission, action), f"Action column {action} missing"
            assert getattr(permission, action) is False  # Default value


class TestUserRoleModel:
    """Test UserRoleModel (association table)."""
    
    @pytest.mark.asyncio
    async def test_create_user_role_association(self, test_session):
        """Test creating user-role association."""
        user = UserModel(
            id=uuid4(),
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )
        
        role = RoleModel(id=uuid4(), name="admin")
        
        test_session.add(user)
        test_session.add(role)
        await test_session.flush()
        
        user_role = UserRoleModel(
            id=uuid4(),
            user_id=user.id,
            role_id=role.id,
        )
        
        test_session.add(user_role)
        await test_session.commit()
        
        result = await test_session.get(UserRoleModel, user_role.id)
        assert result is not None
        assert result.user_id == user.id
        assert result.role_id == role.id
    
    @pytest.mark.asyncio
    async def test_user_role_unique_constraint(self, test_session):
        """Test that (user_id, role_id) must be unique."""
        user = UserModel(
            id=uuid4(),
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )
        
        role = RoleModel(id=uuid4(), name="admin")
        
        test_session.add(user)
        test_session.add(role)
        await test_session.flush()
        
        user_role1 = UserRoleModel(
            id=uuid4(),
            user_id=user.id,
            role_id=role.id,
        )
        
        user_role2 = UserRoleModel(
            id=uuid4(),
            user_id=user.id,
            role_id=role.id,  # Duplicate
        )
        
        test_session.add(user_role1)
        await test_session.commit()
        
        test_session.add(user_role2)
        with pytest.raises(Exception):  # IntegrityError
            await test_session.commit()


class TestRefreshTokenModel:
    """Test RefreshTokenModel."""
    
    @pytest.mark.asyncio
    async def test_create_refresh_token(self, test_session):
        """Test creating a refresh token."""
        user = UserModel(
            id=uuid4(),
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )
        
        test_session.add(user)
        await test_session.flush()
        
        token = RefreshTokenModel(
            id=uuid4(),
            user_id=user.id,
            token_hash="hashed_token",
            jti="jti_123",
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        
        test_session.add(token)
        await test_session.commit()
        
        result = await test_session.get(RefreshTokenModel, token.id)
        assert result is not None
        assert result.token_hash == "hashed_token"
        assert result.jti == "jti_123"
    
    @pytest.mark.asyncio
    async def test_refresh_token_jti_unique_constraint(self, test_session):
        """Test that JTI must be unique."""
        user = UserModel(
            id=uuid4(),
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )
        
        test_session.add(user)
        await test_session.flush()
        
        token1 = RefreshTokenModel(
            id=uuid4(),
            user_id=user.id,
            token_hash="hash1",
            jti="duplicate_jti",
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        
        token2 = RefreshTokenModel(
            id=uuid4(),
            user_id=user.id,
            token_hash="hash2",
            jti="duplicate_jti",  # Duplicate JTI
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        
        test_session.add(token1)
        await test_session.commit()
        
        test_session.add(token2)
        with pytest.raises(Exception):  # IntegrityError
            await test_session.commit()


class TestRelationships:
    """Test relationships between models."""
    
    @pytest.mark.asyncio
    async def test_user_roles_relationship(self, test_session):
        """Test user-roles relationship."""
        user = UserModel(
            id=uuid4(),
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            password_hash="hash",
        )
        
        role1 = RoleModel(id=uuid4(), name="admin")
        role2 = RoleModel(id=uuid4(), name="user")
        
        test_session.add_all([user, role1, role2])
        await test_session.flush()
        
        user_role1 = UserRoleModel(user_id=user.id, role_id=role1.id)
        user_role2 = UserRoleModel(user_id=user.id, role_id=role2.id)
        
        test_session.add_all([user_role1, user_role2])
        await test_session.commit()
        
        # Reload user with relationships
        await test_session.refresh(user)
        assert len(user.roles) == 2
    
    @pytest.mark.asyncio
    async def test_permission_role_resource_relationship(self, test_session):
        """Test permission-role-resource relationships."""
        role = RoleModel(id=uuid4(), name="admin")
        resource = ResourceModel(id=uuid4(), name="land")
        
        test_session.add_all([role, resource])
        await test_session.flush()
        
        permission = PermissionModel(
            id=uuid4(),
            role_id=role.id,
            resource_id=resource.id,
        )
        
        test_session.add(permission)
        await test_session.commit()
        
        # Verify relationships
        await test_session.refresh(permission)
        assert permission.role.name == "admin"
        assert permission.resource.name == "land"


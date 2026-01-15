"""
Unit tests for PermissionMatrix entity
"""

import pytest
from uuid import uuid4

from src.domain.entities.permission_matrix import PermissionMatrix


class TestPermissionMatrix:
    """Test suite for PermissionMatrix entity."""
    
    def test_create_permission_matrix_defaults(self):
        """Test creating permission matrix with default values."""
        role_id = uuid4()
        resource_id = uuid4()
        
        matrix = PermissionMatrix.create(role_id=role_id, resource_id=resource_id)
        
        assert matrix.role_id == role_id
        assert matrix.resource_id == resource_id
        # All actions should default to False
        assert matrix.land_view_public_lands is False
        assert matrix.verify_submit_case is False
        assert matrix.kbs_access_courses is False
        assert matrix.partner_create is False
        assert matrix.administrateur_read is False
    
    def test_create_permission_matrix_with_permissions(self):
        """Test creating permission matrix with specific permissions."""
        role_id = uuid4()
        resource_id = uuid4()
        
        matrix = PermissionMatrix.create(
            role_id=role_id,
            resource_id=resource_id,
            land_view_public_lands=True,
            land_reserve_land=True,
            verify_submit_case=True,
        )
        
        assert matrix.land_view_public_lands is True
        assert matrix.land_reserve_land is True
        assert matrix.verify_submit_case is True
        # Other permissions should remain False
        assert matrix.kbs_access_courses is False
        assert matrix.partner_create is False
    
    def test_update_permissions(self):
        """Test updating permissions."""
        role_id = uuid4()
        resource_id = uuid4()
        
        matrix = PermissionMatrix.create(role_id=role_id, resource_id=resource_id)
        
        old_updated_at = matrix.updated_at
        matrix.update_permissions(
            land_view_public_lands=True,
            verify_submit_case=True,
        )
        
        assert matrix.land_view_public_lands is True
        assert matrix.verify_submit_case is True
        assert matrix.updated_at > old_updated_at
    
    def test_update_permissions_invalid_action_fails(self):
        """Test that updating with invalid action name fails."""
        role_id = uuid4()
        resource_id = uuid4()
        
        matrix = PermissionMatrix.create(role_id=role_id, resource_id=resource_id)
        
        with pytest.raises(ValueError, match="Unknown action"):
            matrix.update_permissions(invalid_action=True)
    
    def test_get_action_value(self):
        """Test getting action value."""
        role_id = uuid4()
        resource_id = uuid4()
        
        matrix = PermissionMatrix.create(
            role_id=role_id,
            resource_id=resource_id,
            land_view_public_lands=True,
        )
        
        assert matrix.get_action_value("land_view_public_lands") is True
        assert matrix.get_action_value("kbs_access_courses") is False
    
    def test_get_action_value_invalid_fails(self):
        """Test that getting invalid action value fails."""
        role_id = uuid4()
        resource_id = uuid4()
        
        matrix = PermissionMatrix.create(role_id=role_id, resource_id=resource_id)
        
        with pytest.raises(ValueError, match="Unknown action"):
            matrix.get_action_value("invalid_action")
    
    def test_has_permission(self):
        """Test checking permission."""
        role_id = uuid4()
        resource_id = uuid4()
        
        matrix = PermissionMatrix.create(
            role_id=role_id,
            resource_id=resource_id,
            land_view_public_lands=True,
        )
        
        assert matrix.has_permission("land_view_public_lands") is True
        assert matrix.has_permission("kbs_access_courses") is False
    
    def test_all_actions_property(self):
        """Test that all_actions returns correct list."""
        role_id = uuid4()
        resource_id = uuid4()
        
        matrix = PermissionMatrix.create(role_id=role_id, resource_id=resource_id)
        
        actions = matrix.all_actions
        
        assert len(actions) == 36  # 7 LAND + 5 VERIFY + 7 KBS + 7 KAMNET + 5 PARTNER + 5 ADMINISTRATEUR = 36 actions
        assert "land_view_public_lands" in actions
        assert "verify_submit_case" in actions
        assert "kbs_access_courses" in actions
        assert "kamnet_view_land_catalog" in actions
        assert "partner_create" in actions
        assert "administrateur_read" in actions
    
    def test_all_land_actions(self):
        """Test all LAND actions are present."""
        role_id = uuid4()
        resource_id = uuid4()
        
        matrix = PermissionMatrix.create(role_id=role_id, resource_id=resource_id)
        
        actions = matrix.all_actions
        
        land_actions = [a for a in actions if a.startswith("land_")]
        assert len(land_actions) == 7
        assert "land_view_public_lands" in land_actions
        assert "land_view_agents_catalog" in land_actions
        assert "land_view_agent_land_detail" in land_actions
        assert "land_upsert_land" in land_actions
        assert "land_assign_label_tdt_vefil_vefl" in land_actions
        assert "land_reserve_land" in land_actions
        assert "land_validate_reservation" in land_actions


"""
PermissionMatrix Entity

Represents a permission matrix entry (role × resource × actions).
Each row represents permissions for a specific role-resource combination.
"""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4


@dataclass
class PermissionMatrix:
    """
    Domain entity representing a permission matrix entry.
    
    Each instance represents permissions for a specific (role_id, resource_id) combination.
    Contains 29 boolean columns representing different actions across resources.
    
    Attributes:
        id: Unique identifier
        role_id: Role ID
        resource_id: Resource ID
        # LAND actions
        land_view_public_lands: bool
        land_view_agents_catalog: bool
        land_view_agent_land_detail: bool
        land_upsert_land: bool
        land_assign_label_tdt_vefil_vefl: bool
        land_reserve_land: bool
        land_validate_reservation: bool
        # VERIFY actions
        verify_submit_case: bool
        verify_view_own_results: bool
        verify_process_request: bool
        verify_generate_documents: bool
        verify_rate_case_compliant: bool
        # KBS actions
        kbs_view_kbs_presentation: bool
        kbs_signup: bool
        kbs_access_courses: bool
        kbs_take_exam: bool
        kbs_view_kca_certificate: bool
        kbs_manage_contents: bool
        kbs_manage_candidates: bool
        # KAMNET actions
        kamnet_view_land_catalog: bool
        kamnet_reserve_land: bool
        kamnet_view_referrals_n1: bool
        kamnet_view_referrals_n1_n2_n3: bool
        kamnet_view_personal_network: bool
        kamnet_manage_agents: bool
        kamnet_create_agent: bool
        # PARTNER actions
        partner_create: bool
        partner_read: bool
        partner_update: bool
        partner_delete: bool
        partner_export: bool
        # ADMINISTRATEUR actions
        administrateur_create: bool
        administrateur_read: bool
        administrateur_update: bool
        administrateur_delete: bool
        administrateur_export: bool
        # Metadata
        created_at: datetime
        updated_at: datetime
    """
    
    id: UUID
    role_id: UUID
    resource_id: UUID
    
    # LAND actions
    land_view_public_lands: bool = False
    land_view_agents_catalog: bool = False
    land_view_agent_land_detail: bool = False
    land_upsert_land: bool = False
    land_assign_label_tdt_vefil_vefl: bool = False
    land_reserve_land: bool = False
    land_validate_reservation: bool = False
    
    # VERIFY actions
    verify_submit_case: bool = False
    verify_view_own_results: bool = False
    verify_process_request: bool = False
    verify_generate_documents: bool = False
    verify_rate_case_compliant: bool = False
    
    # KBS actions
    kbs_view_kbs_presentation: bool = False
    kbs_signup: bool = False
    kbs_access_courses: bool = False
    kbs_take_exam: bool = False
    kbs_view_kca_certificate: bool = False
    kbs_manage_contents: bool = False
    kbs_manage_candidates: bool = False
    
    # KAMNET actions
    kamnet_view_land_catalog: bool = False
    kamnet_reserve_land: bool = False
    kamnet_view_referrals_n1: bool = False
    kamnet_view_referrals_n1_n2_n3: bool = False
    kamnet_view_personal_network: bool = False
    kamnet_manage_agents: bool = False
    kamnet_create_agent: bool = False
    
    # PARTNER actions
    partner_create: bool = False
    partner_read: bool = False
    partner_update: bool = False
    partner_delete: bool = False
    partner_export: bool = False
    
    # ADMINISTRATEUR actions
    administrateur_create: bool = False
    administrateur_read: bool = False
    administrateur_update: bool = False
    administrateur_delete: bool = False
    administrateur_export: bool = False
    
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    @classmethod
    def create(
        cls,
        role_id: UUID,
        resource_id: UUID,
        **action_permissions: bool,
    ) -> "PermissionMatrix":
        """
        Factory method to create a new PermissionMatrix.
        
        Args:
            role_id: Role ID
            resource_id: Resource ID
            **action_permissions: Action permissions to set (e.g., land_view_public_lands=True)
            
        Returns:
            New PermissionMatrix instance
        """
        now = datetime.utcnow()
        instance = cls(
            id=uuid4(),
            role_id=role_id,
            resource_id=resource_id,
            created_at=now,
            updated_at=now,
        )
        
        # Set provided action permissions
        for action, value in action_permissions.items():
            if hasattr(instance, action):
                setattr(instance, action, value)
        
        return instance
    
    def update_permissions(self, **action_permissions: bool) -> None:
        """
        Update action permissions.
        
        Args:
            **action_permissions: Action permissions to update
        """
        for action, value in action_permissions.items():
            if hasattr(self, action):
                setattr(self, action, value)
            else:
                raise ValueError(f"Unknown action: {action}")
        self.updated_at = datetime.utcnow()
    
    def get_action_value(self, action: str) -> bool:
        """
        Get value for a specific action.
        
        Args:
            action: Action name
            
        Returns:
            Permission value for the action
        """
        if not hasattr(self, action):
            raise ValueError(f"Unknown action: {action}")
        return getattr(self, action, False)
    
    def has_permission(self, action: str) -> bool:
        """
        Check if permission is granted for an action.
        
        Args:
            action: Action name
            
        Returns:
            True if permission is granted
        """
        return self.get_action_value(action)
    
    @property
    def all_actions(self) -> list[str]:
        """Get list of all action names."""
        return [
            "land_view_public_lands",
            "land_view_agents_catalog",
            "land_view_agent_land_detail",
            "land_upsert_land",
            "land_assign_label_tdt_vefil_vefl",
            "land_reserve_land",
            "land_validate_reservation",
            "verify_submit_case",
            "verify_view_own_results",
            "verify_process_request",
            "verify_generate_documents",
            "verify_rate_case_compliant",
            "kbs_view_kbs_presentation",
            "kbs_signup",
            "kbs_access_courses",
            "kbs_take_exam",
            "kbs_view_kca_certificate",
            "kbs_manage_contents",
            "kbs_manage_candidates",
            "kamnet_view_land_catalog",
            "kamnet_reserve_land",
            "kamnet_view_referrals_n1",
            "kamnet_view_referrals_n1_n2_n3",
            "kamnet_view_personal_network",
            "kamnet_manage_agents",
            "kamnet_create_agent",
            "partner_create",
            "partner_read",
            "partner_update",
            "partner_delete",
            "partner_export",
            "administrateur_create",
            "administrateur_read",
            "administrateur_update",
            "administrateur_delete",
            "administrateur_export",
        ]


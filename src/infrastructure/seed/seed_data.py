"""
Seed Data

Data definitions for seeding the database (roles, resources).
Uses fixed UUIDs for idempotent seeding.
"""

from uuid import UUID

# Dictionary of roles to seed (18 roles) with fixed UUIDs
ROLES = {
    "public": UUID("00000000-0000-0000-0000-000000000001"),
    "Prospect": UUID("00000000-0000-0000-0000-000000000002"),
    "client": UUID("00000000-0000-0000-0000-000000000003"),
    "kbs_candidate": UUID("00000000-0000-0000-0000-000000000004"),
    "kca_certified": UUID("00000000-0000-0000-0000-000000000005"),
    "kbs_admin": UUID("00000000-0000-0000-0000-000000000006"),
    "agent_junior": UUID("00000000-0000-0000-0000-000000000007"),
    "agent_certified": UUID("00000000-0000-0000-0000-000000000008"),
    "kamnet_manager": UUID("00000000-0000-0000-0000-000000000009"),
    "kamnet_admin": UUID("00000000-0000-0000-0000-00000000000a"),
    "kamnet_root": UUID("00000000-0000-0000-0000-00000000000b"),
    "admin_global": UUID("00000000-0000-0000-0000-00000000000c"),
    "partner_geo": UUID("00000000-0000-0000-0000-00000000000d"),
    "Banques & Assurances": UUID("00000000-0000-0000-0000-00000000000e"),
    "Institution": UUID("00000000-0000-0000-0000-00000000000f"),
    "Notaire": UUID("00000000-0000-0000-0000-000000000010"),
    "Cabinet d'avocat": UUID("00000000-0000-0000-0000-000000000011"),
    "admin_verify": UUID("00000000-0000-0000-0000-000000000012"),
    "admin_land": UUID("00000000-0000-0000-0000-000000000013"),
}

# Dictionary of resources to seed (6 resources) with fixed UUIDs
RESOURCES = {
    "verify": UUID("10000000-0000-0000-0000-000000000001"),
    "land": UUID("10000000-0000-0000-0000-000000000002"),
    "kbs": UUID("10000000-0000-0000-0000-000000000003"),
    "kamnet": UUID("10000000-0000-0000-0000-000000000004"),
    "partner": UUID("10000000-0000-0000-0000-000000000005"),
    "administrateur": UUID("10000000-0000-0000-0000-000000000006"),
}

# Mapping of resource names to their action prefixes
RESOURCE_ACTIONS = {
    "land": [
        "land_view_public_lands",
        "land_view_agents_catalog",
        "land_view_agent_land_detail",
        "land_upsert_land",
        "land_assign_label_tdt_vefil_vefl",
        "land_reserve_land",
        "land_validate_reservation",
    ],
    "verify": [
        "verify_submit_case",
        "verify_view_own_results",
        "verify_process_request",
        "verify_generate_documents",
        "verify_rate_case_compliant",
    ],
    "kbs": [
        "kbs_view_kbs_presentation",
        "kbs_signup",
        "kbs_access_courses",
        "kbs_take_exam",
        "kbs_view_kca_certificate",
        "kbs_manage_contents",
        "kbs_manage_candidates",
    ],
    "kamnet": [
        "kamnet_view_land_catalog",
        "kamnet_reserve_land",
        "kamnet_view_referrals_n1",
        "kamnet_view_referrals_n1_n2_n3",
        "kamnet_view_personal_network",
        "kamnet_manage_agents",
        "kamnet_create_agent",
    ],
    "partner": [
        "partner_create",
        "partner_read",
        "partner_update",
        "partner_delete",
        "partner_export",
    ],
    "administrateur": [
        "administrateur_create",
        "administrateur_read",
        "administrateur_update",
        "administrateur_delete",
        "administrateur_export",
    ],
}

"""
Seed Data

Data definitions for seeding the database (roles, resources).
"""

# List of roles to seed (18 roles)
ROLES = [
    "public",
    "Prospect",
    "client",
    "kbs_candidate",
    "kca_certified",
    "kbs_admin",
    "agent_junior",
    "agent_certified",
    "kamnet_manager",
    "kamnet_admin",
    "kamnet_root",
    "admin_global",
    "partner_geo",
    "Banques & Assurances",
    "Institution",
    "Notaire",
    "Cabinet d'avocat",
    "admin_verify",
    "admin_land",
]

# List of resources to seed (6 resources)
RESOURCES = [
    "verify",
    "land",
    "kbs",
    "kamnet",
    "partner",
    "administrateur",
]

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

"""
Permission Matrix DTOs

Data Transfer Objects for permission matrix responses.
"""

from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, Field


class ActionPermissionResponse(BaseModel):
    """Response DTO for an action permission."""

    action: str = Field(..., description="Action name")
    allowed: bool = Field(..., description="Whether the action is allowed")

    class Config:
        json_schema_extra: ClassVar[dict] = {
            "example": {
                "action": "read",
                "allowed": True,
            }
        }


class ResourcePermissionResponse(BaseModel):
    """Response DTO for resource permissions."""

    resource_id: UUID = Field(..., description="Resource ID")
    resource_name: str = Field(..., description="Resource name")
    actions: list[ActionPermissionResponse] = Field(..., description="List of action permissions")

    class Config:
        json_schema_extra: ClassVar[dict] = {
            "example": {
                "resource_id": "10000000-0000-0000-0000-000000000001",
                "resource_name": "verify",
                "actions": [
                    {"action": "read", "allowed": True},
                    {"action": "create", "allowed": False},
                ],
            }
        }


class RolePermissionResponse(BaseModel):
    """Response DTO for role permissions."""

    role_id: UUID = Field(..., description="Role ID")
    role_name: str = Field(..., description="Role name")
    resources: list[ResourcePermissionResponse] = Field(
        ..., description="List of resource permissions"
    )

    class Config:
        json_schema_extra: ClassVar[dict] = {
            "example": {
                "role_id": "00000000-0000-0000-0000-000000000001",
                "role_name": "public",
                "resources": [
                    {
                        "resource_id": "10000000-0000-0000-0000-000000000001",
                        "resource_name": "verify",
                        "actions": [{"action": "read", "allowed": True}],
                    }
                ],
            }
        }


class PermissionMatrixResponse(BaseModel):
    """Response DTO for the complete permission matrix."""

    roles: list[RolePermissionResponse] = Field(
        ..., description="List of roles with their permissions"
    )

    class Config:
        json_schema_extra: ClassVar[dict] = {
            "example": {
                "roles": [
                    {
                        "role_id": "00000000-0000-0000-0000-000000000001",
                        "role_name": "public",
                        "resources": [
                            {
                                "resource_id": "10000000-0000-0000-0000-000000000001",
                                "resource_name": "verify",
                                "actions": [{"action": "read", "allowed": True}],
                            }
                        ],
                    }
                ]
            }
        }

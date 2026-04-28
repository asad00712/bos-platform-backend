# Roles & Permissions Module (crm-core)

Manages tenant roles and their permission assignments. Exposes seeded system roles and vertical-specific roles to the frontend, and lets admins create custom roles with fine-grained permission control.

## The Two-Level Role System

```
scopeType = 'tenant'   →  Company-wide roles
                           branchId = NULL in UserBranchMembership
                           System: owner, admin
                           Effect: access across ALL branches

scopeType = 'branch'   →  Branch-level roles
                           branchId = specific UUID in UserBranchMembership
                           System: manager, staff, viewer + vertical roles
                           Effect: access ONLY within the assigned branch
```

This invariant is enforced at:
1. **Role creation** — `scopeType` is set at creation and cannot be changed
2. **Staff invite / role assignment** — StaffService validates that branch-scoped roles have a `branchId`
3. **DB layer** — `UserBranchMembership` has a CHECK constraint: `scopeType='tenant'→branchId IS NULL`, `scopeType='branch'→branchId IS NOT NULL`

## Public API (HTTP)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/roles` | — | List all roles (system + custom) |
| GET | `/roles/permissions` | `tenant:users:manage_roles` | List all permissions (for role-builder UI) |
| GET | `/roles/:roleId` | — | Get role with full permission list |
| POST | `/roles` | `tenant:users:manage_roles` | Create a custom role |
| PUT | `/roles/:roleId/permissions` | `tenant:users:manage_roles` | Replace a role's full permission set |
| DELETE | `/roles/:roleId` | `tenant:users:manage_roles` | Delete a custom role |

Read endpoints are open to all authenticated tenant users (staff need to see available roles). Mutations require `tenant:users:manage_roles` (owner/admin only).

## Seeded Roles (isSystem = true)

Seeded on tenant provisioning — **cannot be deleted**.

### Tenant-scoped (company-wide)

| Slug | Name | Notes |
|---|---|---|
| `owner` | Owner | Full access including tenant deletion. Permissions cannot be modified. |
| `admin` | Administrator | Full access except tenant deletion. Permissions cannot be modified. |

### Branch-scoped (per-branch)

| Slug | Name |
|---|---|
| `manager` | Manager |
| `staff` | Staff |
| `viewer` | Viewer |

Plus **vertical-specific** roles seeded based on the tenant's vertical:
- **Medical**: `doctor`, `nurse`, `receptionist`
- **Law**: `partner`, `associate`, `paralegal`
- **Restaurant**: `restaurant_manager`, `waiter`, `chef`
- **School**: `principal`, `teacher`
- **Gym**: `trainer`, `gym_receptionist`

## Custom Roles

Admins can create custom roles with any slug, name, scopeType, and permission combination. Rules:
- Slug must be unique within the tenant (lowercase, hyphens, underscores only)
- `scopeType` is **immutable after creation**
- Only custom roles (`isSystem=false`) can be deleted
- A role in use (`countUsersWithRole > 0`) cannot be deleted — reassign first

## Permission System

Permissions follow the pattern: `<scope>:<resource>:<action>`

Examples:
```
tenant:contacts:create
tenant:contacts:view_branch
tenant:users:invite
tenant:users:manage_roles
tenant:branches:manage
medical:prescriptions:sign   ← vertical-specific
```

`GET /roles/permissions` returns the full list of permissions seeded for this tenant (core + vertical). Frontend uses this to build the permission checkbox grid in the role editor.

`PUT /roles/:roleId/permissions` does a **full replace** — send the complete desired set, not a diff. This avoids partial-update race conditions.

## System Role Protection

`owner` and `admin` cannot have their permissions modified — they hold `tenant:*` by design. Attempting `PUT /roles/:roleId/permissions` on them returns `403 Forbidden`.

All system roles (`isSystem=true`) cannot be deleted — `DELETE /roles/:roleId` returns `403 Forbidden`.

## Database Tables Touched

| Table | Schema | Operation |
|---|---|---|
| `roles` | `bos_core.tenant_{uuid}` | Read, create, delete |
| `permissions` | `bos_core.tenant_{uuid}` | Read only (seeded, immutable) |
| `role_permissions` | `bos_core.tenant_{uuid}` | Read, create, delete (via replacePermissions) |
| `user_branch_memberships` | `bos_core.tenant_{uuid}` | Count only (in-use check) |
| `tenants` | `bos_core.public` | Read schemaName |

## Events Emitted

None yet. Planned:
- `role.created` — audit log
- `role.permissions_updated` — invalidate permission cache for all users with this role
- `role.deleted` — audit log

## Open Questions

- **`scopeType` immutability** — currently enforced at the service layer only (no DB constraint). Should be added as a Postgres trigger or check constraint in a future migration.
- **Permission inheritance** — no role hierarchy yet (e.g., `senior-doctor` inherits from `doctor`). Flat permission model for now.
- **Vertical slug on custom roles** — `verticalSlug` is stored but not validated against the tenant's actual vertical. Future: restrict vertical-prefixed permissions to tenants of that vertical.

# Branches Module (crm-core)

Manages physical locations (branches) within a tenant. Every tenant has at least one branch ("Main") auto-created on provisioning. Single-location businesses never interact with this module directly — multi-location businesses use it to set up and manage their locations.

## Purpose

- Create/update/deactivate branches within a tenant
- Provide branch list to the Staff invite form (for branch assignment)
- Enforce "last branch" protection — a tenant can never be left with zero active branches
- Support hierarchical branch structure (`parentBranchId`) for regional groupings

## Public API (HTTP)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/branches` | — | List all active branches (paginated) |
| GET | `/branches?includeInactive=true` | — | Include deactivated branches |
| GET | `/branches/:branchId` | — | Get single branch with children |
| POST | `/branches` | `tenant:branches:manage` | Create a new branch |
| PATCH | `/branches/:branchId` | `tenant:branches:manage` | Update branch details |
| DELETE | `/branches/:branchId` | `tenant:branches:manage` | Deactivate branch (soft delete) |

Read endpoints are open to all authenticated tenant users. Mutations require `tenant:branches:manage` (held by `owner` and `admin` roles).

## Branch Code

Every branch has a short, unique `code` (e.g., `KHI-01`, `MAIN-01`). It is:
- Auto-uppercased on create/lookup
- Alphanumeric + hyphens + underscores only
- 2–20 characters
- Unique per tenant (enforced at DB + service layer)

## Head Office

- Every tenant should have exactly one `isHeadOffice=true` branch
- Head office can be deactivated only if other active branches exist
- On tenant provisioning, "Main" branch is auto-created with `isHeadOffice=true`, `code='MAIN-01'`

## Branch Hierarchy

Branches can have a `parentBranchId` for regional groupings (e.g., "Karachi Region" → "Clifton Branch", "Defence Branch"). This is purely informational for now — query scoping is always per individual branch, not per region.

## Deactivation vs Deletion

`DELETE /branches/:branchId` does a **soft delete**: sets `isActive=false` and `deletedAt=now()`. The branch row is retained for audit purposes. Deactivated branches are excluded from all list queries by default.

Staff assigned to a deactivated branch retain their `UserBranchMembership` rows (revokedAt=null). Their permissions for that branch become effectively dead — but the rows are not deleted. A future cleanup job or "staff.branch_deactivated" event should handle reassignment.

## Database Tables Touched

| Table | Schema | Operation |
|---|---|---|
| `branches` | `bos_core.tenant_{uuid}` | Full CRUD |
| `user_branch_memberships` | `bos_core.tenant_{uuid}` | Count only (for deactivation warning) |
| `tenants` | `bos_core.public` | Read schemaName |

## Events Emitted

None yet. Planned:
- `branch.created` — for audit log
- `branch.deactivated` — trigger staff reassignment flow

## Open Questions

- **Head office transfer** — if the current head office is deactivated, should another branch be automatically promoted? Currently not enforced.
- **Branch deletion (hard delete)** — not exposed. Deactivation is the only option.
- **Regional grouping queries** — `parentBranchId` is stored but no "get all branches in a region" endpoint exists yet.

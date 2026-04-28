# Staff Module (crm-core)

Manages the people who operate a tenant's BOS account: invite new team members, list existing staff, update role assignments, and deactivate staff who have left.

## Purpose

Staff data spans **two** Prisma schemas joined at the application layer:

| Source | Data |
|---|---|
| `bos_core.public` (CorePrismaService) | `User` identity, `TenantMembership` status, `UserInvite` records |
| `bos_core.tenant_{uuid}` (TenantPrismaService) | `UserBranchMembership` (role + branch assignments), `Role`, `Branch` |

No foreign keys exist between schemas — cross-schema integrity is enforced at the service layer.

## Public API (HTTP)

| Method | Path | Permission Required | Description |
|---|---|---|---|
| GET | `/staff` | — | List all staff (paginated, max 100/page) |
| GET | `/staff/invites` | `tenant:users:invite` | List pending (unexpired, unaccepted) invites |
| GET | `/staff/:userId` | — | Single staff member with role assignments |
| POST | `/staff/invite` | `tenant:users:invite` | Invite a new staff member |
| PATCH | `/staff/:userId/role` | `tenant:users:manage_roles` | Update a role assignment |
| DELETE | `/staff/:userId` | `tenant:users:manage_roles` | Deactivate a staff member |
| DELETE | `/staff/invites/:inviteId` | `tenant:users:invite` | Revoke a pending invite |

## Invite Flow

```
POST /staff/invite
      │
      ▼
1. Validate roleId exists in tenant schema
2. Check email — throw 409 if already an active member
3. $transaction (core DB):
   - User.upsert({ email }) → status=invited if new
   - TenantMembership.upsert → status=invited
   - UserInvite.create { tokenHash, roleId, branchId, expiresAt=+48h }
4. Queue STAFF_INVITE email → bos.mail queue (transactional Redis)
5. Return 204
```

The raw invite token is **never stored** — only its SHA-256 hash. The accept endpoint (Auth Service, `/auth/invite/accept`) validates the submitted token against the stored hash.

## Deactivation Flow

```
DELETE /staff/:userId
      │
      ▼
1. Guard: isOwner check
   - If target is the last owner → throw CannotRemoveLastOwnerException (409)
2. CorePrismaService: TenantMembership → status=suspended
3. TenantPrismaService: UserBranchMembership.updateMany → revokedAt=now
   (both operations run in parallel via Promise.all)
4. Return 204
```

Note: this does **not** delete the user or revoke their active sessions. Session revocation is the Auth Service's job — a future event (`staff.deactivated`) should trigger it.

## Role Update Flow

```
PATCH /staff/:userId/role { roleId, branchId? }
      │
      ▼
1. Validate roleId exists in tenant schema
2. Guard: CannotRemoveLastOwnerException if last owner being demoted
3. $transaction (tenant schema):
   - Revoke existing active assignment at the same branch scope
   - Create new UserBranchMembership { userId, roleId, branchId, assignedByUserId }
4. Return 204
```

## Guards & Security

- **Last-owner protection** — both `DELETE /staff/:userId` and `PATCH /staff/:userId/role` count active `owner`-role assignments. If the target is the sole owner, the operation is rejected with `CANNOT_REMOVE_LAST_OWNER` (409).
- **Permission resolver** — `@RequirePermission` decorators are enforced by `PermissionsGuard`, which calls `TenantPermissionResolverService` to load slugs from the DB (60s LRU cache).
- **Invite token security** — 32-byte crypto random, SHA-256 hashed at rest, 48h TTL.

## Database Tables Touched

| Table | Schema | Operation |
|---|---|---|
| `users` | `bos_core.public` | Upsert on invite (new user) |
| `tenant_memberships` | `bos_core.public` | Read, upsert (invite), suspend (deactivate) |
| `user_invites` | `bos_core.public` | Create, read, update (revoke, accept) |
| `tenants` | `bos_core.public` | Read (schemaName, name) |
| `user_branch_memberships` | `bos_core.tenant_{uuid}` | Read, create, revoke |
| `roles` | `bos_core.tenant_{uuid}` | Read (validate roleId) |
| `branches` | `bos_core.tenant_{uuid}` | Read (branch names for response) |

## Events Emitted

None yet. Planned:
- `staff.invited` — trigger downstream notifications
- `staff.deactivated` — revoke active sessions in Auth Service
- `staff.role_updated` — invalidate permission cache for the affected user

## Queues Used

| Queue | Job | When |
|---|---|---|
| `bos.mail` (transactional) | `send-email` (STAFF_INVITE template) | On every successful invite |

## Dependencies

- `StaffRepository` — data access; wraps CorePrismaService + TenantPrismaService queries
- `CorePrismaService` — core DB operations
- `TenantPrismaService` — tenant schema operations
- `ConfigService` — reads `APP_FRONTEND_URL` for invite link construction
- `@bos/queue` — BullMQ mail queue injection

## Open Questions

- **Session revocation on deactivate** — currently we only suspend the membership. Auth Service sessions stay alive until JWT expiry. A `staff.deactivated` event that triggers session revocation is needed before prod.
- **Invite acceptance endpoint** — `POST /auth/invite/accept { token, password }` lives in Auth Service and is not yet built. Until it is, invite emails go out but users cannot complete onboarding.
- **Re-activation flow** — no endpoint to re-activate a suspended staff member yet.
- **Bulk invite** — single invite per request for now. Bulk (CSV upload) is Phase 2.

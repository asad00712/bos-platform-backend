# CRM Core — Module Map

> **Service**: `crm-core` (port 3002)
> Every module follows: `Controller → Service → Repository`

---

## Module Dependency Graph

```
AppModule
├── BosAuthClientModule      (JWT guard + PermissionsGuard — APP_GUARD)
├── BosDatabaseModule        (CorePrismaService + TenantPrismaService)
├── BosQueueModule.forRoot() (BullMQ — transactional + heavy Redis connections)
├── BosRedisModule           (REDIS_CLIENT — operational Redis for sessions/RR counters)
│
├── TenantModule             → CorePrismaService
├── StaffModule              → CorePrismaService, TenantPrismaService, MAIL queue
├── BranchesModule           → TenantPrismaService
├── RolesModule              → TenantPrismaService
├── CustomFieldsModule       → TenantPrismaService
│
├── TagsModule               → TenantPrismaService
│   └── exported: TagService, TagRepository
│
├── ContactsModule           → TenantPrismaService, TagsModule
│   └── exported: ContactService, ContactRepository, ContactSourceService
│
├── LeadsModule              → TenantPrismaService, CorePrismaService,
│   │                          TagsModule, ContactsModule, WORKFLOW queue
│   └── exported: LeadService
│
├── LeadAssignmentModule     → TenantPrismaService, REDIS_CLIENT, WORKFLOW queue
│   ├── LeadAssignmentController  (GET/PUT /lead-assignment-config)
│   └── LeadAssignmentProcessor   (@Processor on bos.workflow — handles crm.lead.created)
│
└── WebhooksModule           → LeadsModule (LeadService), REDIS_CLIENT, CorePrismaService
    ├── LeadWebhooksController     (protected CRUD — /lead-webhooks)
    └── WebhookIngestionController (public — POST /webhooks/leads/:token)
```

---

## Endpoints by Module

### Staff (`/staff`)
| Method | Path | Permission |
|--------|------|------------|
| GET | `/staff` | — |
| GET | `/staff/invites` | `tenant:users:invite` |
| GET | `/staff/:userId` | — |
| POST | `/staff/invite` | `tenant:users:invite` |
| PATCH | `/staff/:userId/role` | `tenant:users:manage_roles` |
| PATCH | `/staff/:userId/round-robin` | `tenant:staff:round_robin` |
| DELETE | `/staff/:userId` | `tenant:users:manage_roles` |
| DELETE | `/staff/invites/:inviteId` | `tenant:users:invite` |

### Tags (`/tags`)
| Method | Path | Permission |
|--------|------|------------|
| GET | `/tags` | — |
| POST | `/tags` | `tenant:tags:manage` |
| PATCH | `/tags/:id` | `tenant:tags:manage` |
| DELETE | `/tags/:id` | `tenant:tags:manage` |

### Contacts (`/contacts`, `/contact-sources`, `/contact-lists`)
See `src/modules/contacts/README.md`

### Leads (`/leads`, `/lead-statuses`)
See `src/modules/leads/README.md`

### Lead Assignment Config (`/lead-assignment-config`)
| Method | Path | Permission |
|--------|------|------------|
| GET | `/lead-assignment-config?branchId=` | — |
| PUT | `/lead-assignment-config` | `tenant:leads:configure` |

### Lead Webhooks (`/lead-webhooks`, `/webhooks`)
| Method | Path | Permission |
|--------|------|------------|
| GET | `/lead-webhooks` | `tenant:leads:configure` |
| POST | `/lead-webhooks` | `tenant:leads:configure` |
| PATCH | `/lead-webhooks/:id` | `tenant:leads:configure` |
| DELETE | `/lead-webhooks/:id` | `tenant:leads:configure` |
| POST | `/lead-webhooks/:id/regenerate-token` | `tenant:leads:configure` |
| POST | `/webhooks/leads/:token` | **PUBLIC** (token auth) |

---

## Event Flow (BullMQ `bos.workflow`)

```
POST /leads  →  LeadService.createLead()
                 ├── Contact upsert (by email) or create
                 └── emit: crm.lead.created
                             ↓
                    LeadAssignmentProcessor
                     ├── get LeadAssignmentConfig (eligibleRoleIds, isActive)
                     ├── get eligible agents (roundRobinAvailable=true + role match)
                     ├── Redis INCR bos:rr:leads:{tenantId}:{branchId}
                     ├── lead.ownedByUserId = agents[counter % count]
                     └── emit: crm.lead.assigned
                                 ↓
                        [Future: Automation module]
                         ├── welcome SMS to contact
                         ├── notify assigned agent
                         └── owner notification

PATCH /leads/:id { statusId }  →  emit: crm.lead.status_changed
                                              ↓
                                   [Future: Automation module]
                                    └── trigger configured rules (e.g. notify on drop)
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Contact auto-created on lead creation | GHL/HubSpot model — contact = real person, exists regardless of lead outcome |
| Email-based contact dedup | Same person submits twice → linked, not duplicated |
| `contact.originLeadId` soft ref | Traceability — which lead created this contact |
| Round-robin via Redis INCR | Atomic, no race conditions, O(1), survives restarts |
| Webhook token in Redis | O(1) tenant lookup without scanning all schemas |
| `roundRobinAvailable` preserved on role change | Operator sets availability once — role updates don't reset it |
| Events not automations | Business rules belong in Automation module, not hardcoded per-event |

---

## Phase 2 Deferred

- **Configurable webhook field mapping** — `mappingConfig: JSON` per webhook
- **Facebook Lead Ads integration** — Meta Webhooks API consumer
- **Instagram Lead Ads** — same Meta Webhooks infrastructure
- **Zapier / Make.com** — BOS native app
- **Smart contact lists** — dynamic filter-based lists (currently static only)
- **Lead scoring** — `bos.ai-lead` queue consumer (AI scoring on lead creation)
- **Automation module** — rules engine that consumes `crm.lead.*` events

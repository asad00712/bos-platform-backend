# Tags Module

Tenant-wide shared tag pool. Tags can be applied to **Contacts** and **Leads** via a polymorphic `EntityTag` junction table.

## Endpoints

| Method   | Path           | Permission              | Description                         |
|----------|----------------|-------------------------|-------------------------------------|
| `GET`    | `/tags`        | view_branch (any)       | List all tags (optional `?search=`) |
| `POST`   | `/tags`        | `tenant:tags:manage`    | Create a tag                        |
| `PATCH`  | `/tags/:id`    | `tenant:tags:manage`    | Update name or color                |
| `DELETE` | `/tags/:id`    | `tenant:tags:manage`    | Delete tag (cascades EntityTag rows)|

Tag names are **unique per tenant**. Colors are optional hex strings (`#RRGGBB`).

## Data Model

```
Tag          — id, name (unique), color?, isSystem, createdAt, updatedAt
EntityTag    — tagId FK, entityType (CONTACT|LEAD), entityId (soft ref), createdAt
```

`EntityTag.entityId` is a soft reference — no DB FK to Contact or Lead — allowing the same table to cover multiple entity types without cross-schema FK issues.

## Usage

Tags are managed here and referenced by ID from the Contacts and Leads modules:

- `POST /contacts/:id/tags/:tagId` — apply a tag to a contact
- `DELETE /contacts/:id/tags/:tagId` — remove from contact
- `POST /leads/:id/tags/:tagId` — apply a tag to a lead
- `DELETE /leads/:id/tags/:tagId` — remove from lead
- `GET /contacts/:id/tags` / `GET /leads/:id/tags` — list tags on an entity

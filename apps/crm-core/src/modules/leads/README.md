# Leads Module

Manages leads (unqualified inquiries) within tenant branches. Includes per-branch **lead status configuration** and **lead conversion** to contacts.

## Endpoints

### Leads (`/leads`)

| Method   | Path                        | Permission                 | Description                                           |
|----------|-----------------------------|----------------------------|-------------------------------------------------------|
| `GET`    | `/leads`                    | `tenant:leads:view_branch` | List leads (paginated, filterable)                    |
| `GET`    | `/leads/:id`                | `tenant:leads:view_branch` | Get a single lead                                     |
| `POST`   | `/leads`                    | `tenant:leads:create`      | Create a lead                                         |
| `PATCH`  | `/leads/:id`                | `tenant:leads:update`      | Update a lead                                         |
| `DELETE` | `/leads/:id`                | `tenant:leads:delete`      | Soft-delete a lead                                    |
| `POST`   | `/leads/:id/convert`        | `tenant:leads:convert`     | Convert lead → contact                                |
| `GET`    | `/leads/:id/tags`           | `tenant:leads:view_branch` | List tags on a lead                                   |
| `POST`   | `/leads/:id/tags/:tagId`    | `tenant:leads:update`      | Add tag to lead                                       |
| `DELETE` | `/leads/:id/tags/:tagId`    | `tenant:leads:update`      | Remove tag from lead                                  |

**Filter params** (`GET /leads`): `branchId`, `statusId`, `sourceId`, `priority` (LOW|MEDIUM|HIGH), `converted` (true/false), `search`, `page`, `limit`.

### Lead Statuses (`/lead-statuses`)

Per-branch configurable pipeline stages.

| Method   | Path                   | Permission               | Description                              |
|----------|------------------------|--------------------------|------------------------------------------|
| `GET`    | `/lead-statuses`       | —                        | List (optional `?branchId=`)             |
| `POST`   | `/lead-statuses`       | `tenant:sources:manage`  | Create a status                          |
| `PATCH`  | `/lead-statuses/:id`   | `tenant:sources:manage`  | Update name, color, order, active flag   |
| `DELETE` | `/lead-statuses/:id`   | `tenant:sources:manage`  | Delete (NULL cascades on linked leads)   |

## Data Model

```
LeadStatusConfig — id, branchId, name, color?, displayOrder, isSystem, isActive
Lead             — id, branchId, contactId? (FK Contact), firstName, lastName?, email?,
                   phone?, company?, sourceId? (FK ContactSource), statusId? (FK LeadStatusConfig),
                   priority (LOW|MEDIUM|HIGH), estimatedValue?, ownedByUserId?,
                   convertedAt?, convertedByUserId?, notes?, createdByUserId?, deletedAt?
```

## Conversion Logic (`POST /leads/:id/convert`)

Implements the **Salesforce model** — lead stays in DB as converted, a new contact is created/linked:

```json
{ "contactId": "existing-uuid" }   // Option A: link to existing contact
{}                                  // Option B: auto-create new contact from lead data
```

- If `contactId` is provided: links lead to that existing contact (validates it exists).
- If omitted: creates a new Contact using lead's `firstName`, `lastName`, `email`, `phone`, `company`, `sourceId`. Sets `contact.originLeadId = lead.id` for traceability.
- Sets `lead.convertedAt = now()`, `lead.convertedByUserId = caller`.
- Throws `CRM_8003` if lead is already converted.

## Sources

Contact sources are shared with the Contacts module (`/contact-sources`). Both contacts and leads reference `sourceId`. When a lead converts to a contact, the source is preserved on the new contact.

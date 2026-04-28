# Contacts Module

Manages contacts (people/companies) within tenant branches, along with per-branch **contact sources** and **static contact lists**.

## Endpoints

### Contacts (`/contacts`)

| Method   | Path                           | Permission                       | Description                                    |
|----------|--------------------------------|----------------------------------|------------------------------------------------|
| `GET`    | `/contacts`                    | `tenant:contacts:view_branch`    | List contacts (paginated, filterable)          |
| `GET`    | `/contacts/:id`                | `tenant:contacts:view_branch`    | Get a single contact                           |
| `POST`   | `/contacts`                    | `tenant:contacts:create`         | Create a contact                               |
| `PATCH`  | `/contacts/:id`                | `tenant:contacts:update`         | Update a contact                               |
| `DELETE` | `/contacts/:id`                | `tenant:contacts:delete`         | Soft-delete a contact                          |
| `GET`    | `/contacts/:id/tags`           | `tenant:contacts:view_branch`    | List tags on a contact                         |
| `POST`   | `/contacts/:id/tags/:tagId`    | `tenant:contacts:update`         | Add tag to contact                             |
| `DELETE` | `/contacts/:id/tags/:tagId`    | `tenant:contacts:update`         | Remove tag from contact                        |

**Filter params** (`GET /contacts`): `branchId`, `status` (ACTIVE|INACTIVE|ARCHIVED), `sourceId`, `search` (name/email/phone), `page`, `limit`.

### Contact Sources (`/contact-sources`)

Shared by Contacts and Leads. Per-branch configuration.

| Method   | Path                    | Permission                | Description                 |
|----------|-------------------------|---------------------------|-----------------------------|
| `GET`    | `/contact-sources`      | —                         | List (optional `?branchId=`)|
| `POST`   | `/contact-sources`      | `tenant:sources:manage`   | Create a source             |
| `PATCH`  | `/contact-sources/:id`  | `tenant:sources:manage`   | Update name / active flag   |
| `DELETE` | `/contact-sources/:id`  | `tenant:sources:manage`   | Delete (NULL cascades)      |

### Contact Lists (`/contact-lists`)

Phase 1: **Static lists** only. Contacts are manually added/removed.

| Method   | Path                                     | Permission                        | Description                       |
|----------|------------------------------------------|-----------------------------------|-----------------------------------|
| `GET`    | `/contact-lists`                         | `tenant:contacts:view_branch`     | List (optional `?branchId=`)      |
| `POST`   | `/contact-lists`                         | `tenant:contact_lists:manage`     | Create a list                     |
| `PATCH`  | `/contact-lists/:id`                     | `tenant:contact_lists:manage`     | Update name / description         |
| `DELETE` | `/contact-lists/:id`                     | `tenant:contact_lists:manage`     | Delete list                       |
| `GET`    | `/contact-lists/:id/members`             | `tenant:contacts:view_branch`     | Paginated contacts in list        |
| `POST`   | `/contact-lists/:id/members/:contactId`  | `tenant:contact_lists:manage`     | Add contact to list               |
| `DELETE` | `/contact-lists/:id/members/:contactId`  | `tenant:contact_lists:manage`     | Remove contact from list          |

## Data Model

```
ContactSource     — id, branchId, name, isSystem, isActive
Contact           — id, branchId, firstName, lastName?, email?, phone?, company?, jobTitle?,
                    address/city/state/country/postalCode?, sourceId? (FK ContactSource),
                    originLeadId? (soft ref to Lead), status (ACTIVE|INACTIVE|ARCHIVED),
                    ownedByUserId?, notes?, createdByUserId?, deletedAt?
ContactList       — id, branchId, name, description?, listType (STATIC), isActive
ContactListMember — listId FK, contactId FK, addedByUserId?, addedAt
```

## Key Design Decisions

- `Contact.sourceId` is a **direct FK** on the Contact record (Salesforce model). When a lead converts, `sourceId` is copied from the lead to the new contact automatically.
- `Contact.originLeadId` is a **soft reference** (no FK) for traceability — marks which lead triggered creation.
- Soft deletes via `deletedAt` — all queries filter `deletedAt: null`.

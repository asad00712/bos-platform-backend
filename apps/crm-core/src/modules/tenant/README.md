# Tenant Module (crm-core)

Manages tenant-level configuration: module selection, business profile, and vertical terminology. These are the first things a tenant interacts with after signup.

## Purpose

- **Module suggestions** — returns recommended modules for the tenant's vertical (from seeded `ModulePreset` table)
- **Module selection** — saves which modules the tenant wants enabled; always merges in the 4 always-on modules; marks onboarding complete
- **Tenant config** — single endpoint to read enabled modules + vertical-specific display terminology for the frontend
- **Business profile** — update phone, city, website URL, logo URL, and goals

This module has no side-effects beyond writing to the core DB (`bos_core.public`). It does **not** provision or configure anything in the tenant schema.

## Public API (HTTP)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tenant/module-suggestions` | Bearer (tenant) | Suggested modules based on vertical |
| POST | `/tenant/modules` | Bearer (tenant) | Save selected modules + mark onboarding done |
| GET | `/tenant/config` | Bearer (tenant) | Enabled modules + terminology map |
| PATCH | `/tenant/profile` | Bearer (tenant) | Update business profile fields |

No permission guard beyond authentication — all authenticated tenant users can call these endpoints.

## Always-On Modules

These are automatically merged into any `POST /tenant/modules` call and cannot be disabled:

```
CONTACTS | STAFF | BRANCHES | ROLES_PERMISSIONS
```

## Vertical Terminology

The `GET /tenant/config` response includes a `terminology` map keyed by `termKey` (`contact`, `appointment`, `deal`). Example for `vertical=medical`:

```json
{
  "contact":     { "singular": "Patient",     "plural": "Patients",     "icon": null },
  "appointment": { "singular": "Appointment", "plural": "Appointments", "icon": null },
  "deal":        { "singular": "Case",        "plural": "Cases",        "icon": null }
}
```

This lets the frontend swap labels without hardcoding vertical logic.

## Database Tables Touched

| Table | Schema | Operation |
|---|---|---|
| `tenants` | `bos_core.public` | Read + update (profile, onboarding flag) |
| `tenant_modules` | `bos_core.public` | Upsert (module selection) |
| `module_presets` | `bos_core.public` | Read only (seeded) |
| `vertical_terminology` | `bos_core.public` | Read only (seeded) |

## Seeds Required

Both `module_presets` (5 rows) and `vertical_terminology` (15 rows) must be seeded before these endpoints return meaningful data. Run:

```bash
pnpm db:seed:core
```

## Events Emitted

None currently. Future: `tenant.modules_updated` when a tenant changes their module set (for downstream module-specific provisioning).

## Dependencies

- `CorePrismaService` — all reads and writes go to `bos_core.public`
- `TenantModuleRepository` — encapsulates `tenant_modules` upsert logic

## Open Questions

- Module **disabling** — currently you can only enable modules. Disabling (setting `isEnabled=false`) is not exposed yet. Needs a safe removal path (archive data? warn about data loss?).
- Module-specific `config` JSON — the `TenantModule.config` field exists but is not yet populated. Will be used for per-module settings (e.g. WhatsApp phone number, billing currency).

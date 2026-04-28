/**
 * BOS Core — Platform-level seed script.
 *
 * Seeds immutable system data into `bos_core.public`:
 *   - 5 platform roles (super_admin, platform_support, platform_billing,
 *     platform_engineer, marketplace_moderator)
 *   - Platform permissions (platform:*)
 *   - Role → permission assignments
 *   - Default tenant plans (free, starter, pro, enterprise)
 *
 * Idempotent — safe to run multiple times. Uses upsert by unique slug.
 *
 * Run with: pnpm db:seed:core
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ModuleKey, VerticalType } from '@bos-prisma/core';

const connectionString = process.env.DATABASE_URL_CORE;
if (!connectionString) {
  throw new Error('DATABASE_URL_CORE is not set');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Platform permissions (seeded, immutable). Format: platform:<resource>:<action>
// ---------------------------------------------------------------------------
const PLATFORM_PERMISSIONS: ReadonlyArray<{
  slug: string;
  resource: string;
  action: string;
  description: string;
}> = [
  // Tenants
  { slug: 'platform:tenants:view', resource: 'tenants', action: 'view', description: 'List and view tenant details' },
  { slug: 'platform:tenants:create', resource: 'tenants', action: 'create', description: 'Manually create a tenant' },
  { slug: 'platform:tenants:suspend', resource: 'tenants', action: 'suspend', description: 'Suspend a tenant' },
  { slug: 'platform:tenants:delete', resource: 'tenants', action: 'delete', description: 'Soft-delete a tenant' },
  { slug: 'platform:tenants:impersonate', resource: 'tenants', action: 'impersonate', description: 'Impersonate a tenant user for support' },
  // Users
  { slug: 'platform:users:view', resource: 'users', action: 'view', description: 'Search and view users across tenants' },
  { slug: 'platform:users:lock', resource: 'users', action: 'lock', description: 'Lock or unlock any user account' },
  // Billing
  { slug: 'platform:billing:view', resource: 'billing', action: 'view', description: 'View platform revenue and tenant billing' },
  { slug: 'platform:billing:adjust', resource: 'billing', action: 'adjust', description: 'Adjust tenant plan or pricing' },
  { slug: 'platform:billing:refund', resource: 'billing', action: 'refund', description: 'Issue refunds' },
  // Support
  { slug: 'platform:support:read_all', resource: 'support', action: 'read_all', description: 'Read tenant data for support (with audit)' },
  { slug: 'platform:support:tickets_manage', resource: 'support', action: 'tickets_manage', description: 'Manage tenant support tickets' },
  // System
  { slug: 'platform:system:metrics', resource: 'system', action: 'metrics', description: 'View platform health metrics' },
  { slug: 'platform:system:feature_flags', resource: 'system', action: 'feature_flags', description: 'Toggle feature flags per tenant' },
  { slug: 'platform:system:audit_logs', resource: 'system', action: 'audit_logs', description: 'Read platform-wide audit logs' },
  // Marketplace (Phase 3)
  { slug: 'platform:marketplace:review', resource: 'marketplace', action: 'review', description: 'Review plugin submissions' },
  { slug: 'platform:marketplace:publish', resource: 'marketplace', action: 'publish', description: 'Publish or unpublish plugins' },
];

// ---------------------------------------------------------------------------
// Platform roles with their permission slug lists
// ---------------------------------------------------------------------------
const PLATFORM_ROLES: ReadonlyArray<{
  slug: string;
  name: string;
  description: string;
  permissions: string[] | '*';
}> = [
  {
    slug: 'super_admin',
    name: 'Super Administrator',
    description: 'Full control over the BOS platform',
    permissions: '*',
  },
  {
    slug: 'platform_support',
    name: 'Platform Support',
    description: 'Support staff — read tenant data, impersonate with permission',
    permissions: [
      'platform:tenants:view',
      'platform:tenants:impersonate',
      'platform:users:view',
      'platform:support:read_all',
      'platform:support:tickets_manage',
    ],
  },
  {
    slug: 'platform_billing',
    name: 'Platform Billing',
    description: 'Billing and finance staff',
    permissions: [
      'platform:tenants:view',
      'platform:billing:view',
      'platform:billing:adjust',
      'platform:billing:refund',
    ],
  },
  {
    slug: 'platform_engineer',
    name: 'Platform Engineer',
    description: 'Technical operations and feature flag control',
    permissions: [
      'platform:tenants:view',
      'platform:system:metrics',
      'platform:system:feature_flags',
      'platform:system:audit_logs',
    ],
  },
  {
    slug: 'marketplace_moderator',
    name: 'Marketplace Moderator',
    description: 'Plugin review and marketplace curation (Phase 3)',
    permissions: [
      'platform:marketplace:review',
      'platform:marketplace:publish',
    ],
  },
];

// ---------------------------------------------------------------------------
// Default tenant plans
// ---------------------------------------------------------------------------
const TENANT_PLANS: ReadonlyArray<{
  slug: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: Record<string, boolean | number>;
  maxUsers: number | null;
  maxBranches: number | null;
  maxStorageGb: number | null;
  sortOrder: number;
}> = [
  {
    slug: 'free',
    name: 'Free',
    description: 'Get started at no cost — single user, single branch',
    priceMonthly: 0,
    priceYearly: 0,
    features: { crm: true, scheduling: true, basic_reports: true },
    maxUsers: 1,
    maxBranches: 1,
    maxStorageGb: 1,
    sortOrder: 0,
  },
  {
    slug: 'starter',
    name: 'Starter',
    description: 'For small businesses getting organized',
    priceMonthly: 29,
    priceYearly: 290,
    features: { crm: true, scheduling: true, billing: true, documents: true, basic_reports: true },
    maxUsers: 5,
    maxBranches: 1,
    maxStorageGb: 10,
    sortOrder: 1,
  },
  {
    slug: 'pro',
    name: 'Pro',
    description: 'For growing multi-location businesses',
    priceMonthly: 99,
    priceYearly: 990,
    features: { crm: true, scheduling: true, billing: true, documents: true, hrm: true, inventory: true, campaigns: true, custom_reports: true, whatsapp: true },
    maxUsers: 25,
    maxBranches: 5,
    maxStorageGb: 100,
    sortOrder: 2,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited everything with priority support',
    priceMonthly: 299,
    priceYearly: 2990,
    features: { crm: true, scheduling: true, billing: true, documents: true, hrm: true, inventory: true, campaigns: true, custom_reports: true, whatsapp: true, ai_chatbot: true, white_label: true, api_access: true, sla_support: true },
    maxUsers: null,
    maxBranches: null,
    maxStorageGb: null,
    sortOrder: 3,
  },
];

async function seedPermissions(): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();
  for (const perm of PLATFORM_PERMISSIONS) {
    const row = await prisma.platformPermission.upsert({
      where: { slug: perm.slug },
      create: {
        slug: perm.slug,
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
      },
      update: { description: perm.description },
    });
    bySlug.set(perm.slug, row.id);
  }
  return bySlug;
}

async function seedRoles(permIdBySlug: Map<string, string>): Promise<void> {
  for (const role of PLATFORM_ROLES) {
    const row = await prisma.platformRole.upsert({
      where: { slug: role.slug },
      create: {
        slug: role.slug,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
      update: { name: role.name, description: role.description },
    });

    const targetPermSlugs =
      role.permissions === '*'
        ? [...permIdBySlug.keys()]
        : role.permissions;

    // Wipe existing role_permissions and re-seed (idempotent)
    await prisma.platformRolePermission.deleteMany({
      where: { platformRoleId: row.id },
    });
    await prisma.platformRolePermission.createMany({
      data: targetPermSlugs.map((slug) => {
        const permId = permIdBySlug.get(slug);
        if (!permId) {
          throw new Error(`Unknown permission slug: ${slug}`);
        }
        return { platformRoleId: row.id, platformPermissionId: permId };
      }),
      skipDuplicates: true,
    });
  }
}

async function seedPlans(): Promise<void> {
  for (const plan of TENANT_PLANS) {
    await prisma.tenantPlan.upsert({
      where: { slug: plan.slug },
      create: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: plan.features,
        maxUsers: plan.maxUsers,
        maxBranches: plan.maxBranches,
        maxStorage: plan.maxStorageGb ? BigInt(plan.maxStorageGb) * BigInt(1_073_741_824) : null,
        sortOrder: plan.sortOrder,
      },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: plan.features,
        maxUsers: plan.maxUsers,
        maxBranches: plan.maxBranches,
        maxStorage: plan.maxStorageGb ? BigInt(plan.maxStorageGb) * BigInt(1_073_741_824) : null,
        sortOrder: plan.sortOrder,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Module presets — recommended modules per vertical (shown during onboarding)
// ---------------------------------------------------------------------------
const MODULE_PRESETS: ReadonlyArray<{
  vertical: VerticalType;
  modules: ModuleKey[];
}> = [
  { vertical: VerticalType.medical,    modules: [ModuleKey.CONTACTS, ModuleKey.APPOINTMENTS, ModuleKey.DOCUMENTS, ModuleKey.BILLING, ModuleKey.CALENDAR] },
  { vertical: VerticalType.law,        modules: [ModuleKey.CONTACTS, ModuleKey.APPOINTMENTS, ModuleKey.DOCUMENTS, ModuleKey.DEALS_PIPELINE, ModuleKey.BILLING, ModuleKey.CALENDAR] },
  { vertical: VerticalType.restaurant, modules: [ModuleKey.CONTACTS, ModuleKey.INVENTORY, ModuleKey.CAMPAIGNS] },
  { vertical: VerticalType.school,     modules: [ModuleKey.CONTACTS, ModuleKey.APPOINTMENTS, ModuleKey.DOCUMENTS, ModuleKey.CAMPAIGNS] },
  { vertical: VerticalType.gym,        modules: [ModuleKey.CONTACTS, ModuleKey.APPOINTMENTS, ModuleKey.BILLING, ModuleKey.CAMPAIGNS] },
];

// ---------------------------------------------------------------------------
// Vertical terminology — maps generic term keys to vertical-specific labels
// ---------------------------------------------------------------------------
const VERTICAL_TERMINOLOGY: ReadonlyArray<{
  vertical: VerticalType;
  termKey: string;
  singular: string;
  plural: string;
  icon?: string;
}> = [
  // medical
  { vertical: VerticalType.medical, termKey: 'contact',     singular: 'Patient',      plural: 'Patients' },
  { vertical: VerticalType.medical, termKey: 'appointment',  singular: 'Appointment',  plural: 'Appointments' },
  { vertical: VerticalType.medical, termKey: 'deal',         singular: 'Account',      plural: 'Accounts' },
  // law
  { vertical: VerticalType.law,     termKey: 'contact',     singular: 'Client',       plural: 'Clients' },
  { vertical: VerticalType.law,     termKey: 'appointment',  singular: 'Consultation', plural: 'Consultations' },
  { vertical: VerticalType.law,     termKey: 'deal',         singular: 'Matter',       plural: 'Matters' },
  // restaurant
  { vertical: VerticalType.restaurant, termKey: 'contact',     singular: 'Guest',       plural: 'Guests' },
  { vertical: VerticalType.restaurant, termKey: 'appointment',  singular: 'Reservation', plural: 'Reservations' },
  { vertical: VerticalType.restaurant, termKey: 'deal',         singular: 'Order',       plural: 'Orders' },
  // school
  { vertical: VerticalType.school,  termKey: 'contact',     singular: 'Student',      plural: 'Students' },
  { vertical: VerticalType.school,  termKey: 'appointment',  singular: 'Class',        plural: 'Classes' },
  { vertical: VerticalType.school,  termKey: 'deal',         singular: 'Enrollment',   plural: 'Enrollments' },
  // gym
  { vertical: VerticalType.gym,     termKey: 'contact',     singular: 'Member',       plural: 'Members' },
  { vertical: VerticalType.gym,     termKey: 'appointment',  singular: 'Session',      plural: 'Sessions' },
  { vertical: VerticalType.gym,     termKey: 'deal',         singular: 'Package',      plural: 'Packages' },
];

async function seedModulePresets(): Promise<void> {
  for (const preset of MODULE_PRESETS) {
    await prisma.modulePreset.upsert({
      where: { vertical: preset.vertical },
      create: { vertical: preset.vertical, modules: preset.modules },
      update: { modules: preset.modules },
    });
  }
}

async function seedVerticalTerminology(): Promise<void> {
  for (const term of VERTICAL_TERMINOLOGY) {
    await prisma.verticalTerminology.upsert({
      where: { vertical_termKey: { vertical: term.vertical, termKey: term.termKey } },
      create: {
        vertical: term.vertical,
        termKey: term.termKey,
        singular: term.singular,
        plural: term.plural,
        icon: term.icon ?? null,
      },
      update: {
        singular: term.singular,
        plural: term.plural,
        icon: term.icon ?? null,
      },
    });
  }
}

async function main(): Promise<void> {
  console.log('[seed:core] Seeding platform permissions...');
  const permIdBySlug = await seedPermissions();
  console.log(`[seed:core]   ${permIdBySlug.size} permissions upserted.`);

  console.log('[seed:core] Seeding platform roles...');
  await seedRoles(permIdBySlug);
  console.log(`[seed:core]   ${PLATFORM_ROLES.length} roles upserted.`);

  console.log('[seed:core] Seeding tenant plans...');
  await seedPlans();
  console.log(`[seed:core]   ${TENANT_PLANS.length} plans upserted.`);

  console.log('[seed:core] Seeding module presets...');
  await seedModulePresets();
  console.log(`[seed:core]   ${MODULE_PRESETS.length} module presets upserted.`);

  console.log('[seed:core] Seeding vertical terminology...');
  await seedVerticalTerminology();
  console.log(`[seed:core]   ${VERTICAL_TERMINOLOGY.length} terminology entries upserted.`);

  console.log('[seed:core] Done.');
}

main()
  .catch((err: unknown) => {
    console.error('[seed:core] Failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

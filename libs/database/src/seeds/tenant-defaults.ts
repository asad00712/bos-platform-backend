/**
 * Default data for a newly-provisioned tenant schema.
 *
 * Used by TenantSchemaManager.createSchema() after running the Prisma
 * tenant template migration. Seeds:
 *   - 1 default "Main" branch
 *   - Core tenant roles (owner, admin, manager, staff, viewer)
 *   - Core tenant permissions (tenant:*)
 *   - Role -> permission assignments
 *   - Vertical-specific roles + permissions (based on tenant.vertical)
 *
 * The raw SQL CHECK constraint (scopeType vs branchId invariant) is applied
 * separately by TenantSchemaManager using buildTenantPostMigrationSql.
 */

/**
 * Post-migration SQL applied to every tenant schema after the Prisma
 * tenant template migration runs. Adds a CHECK constraint enforcing
 * the role scopeType vs branchId invariant at the database level.
 *
 * Schema name must be validated by the caller against /^tenant_[a-f0-9]{8,}$/
 * before being passed here -- never trust untyped input.
 */
export function buildTenantPostMigrationSql(schemaName: string): string {
  return [
    `ALTER TABLE "${schemaName}"."UserBranchMembership"`,
    `ADD CONSTRAINT "UserBranchMembership_scope_branch_invariant"`,
    `CHECK (`,
    `  ("branchId" IS NULL)`,
    `  OR EXISTS (`,
    `    SELECT 1 FROM "${schemaName}"."Role" r`,
    `    WHERE r.id = "UserBranchMembership"."roleId"`,
    `      AND r."scopeType"::text = 'branch'`,
    `  )`,
    `);`,
  ].join('\n');
}

export interface TenantRoleSeed {
  slug: string;
  name: string;
  scopeType: 'tenant' | 'branch';
  description: string;
  /** '*' grants all seeded tenant permissions + vertical permissions. */
  permissionSlugs: readonly string[] | '*';
}

export interface TenantPermissionSeed {
  slug: string;
  resource: string;
  action: string;
  description: string;
}

/**
 * Core tenant roles — seeded in every tenant regardless of vertical.
 */
export const CORE_TENANT_ROLES: readonly TenantRoleSeed[] = [
  {
    slug: 'owner',
    name: 'Owner',
    scopeType: 'tenant',
    description: 'Full control including deletion and ownership transfer',
    permissionSlugs: '*',
  },
  {
    slug: 'admin',
    name: 'Administrator',
    scopeType: 'tenant',
    description: 'Full organizational access except tenant deletion',
    permissionSlugs: '*',
  },
  {
    slug: 'manager',
    name: 'Manager',
    scopeType: 'branch',
    description: 'Full CRM/scheduling/billing management within assigned branch',
    permissionSlugs: [
      'tenant:contacts:view_branch',
      'tenant:contacts:create',
      'tenant:contacts:update',
      'tenant:contacts:delete',
      'tenant:leads:view_branch',
      'tenant:leads:create',
      'tenant:leads:update',
      'tenant:leads:delete',
      'tenant:leads:convert',
      'tenant:leads:configure',
      'tenant:tags:manage',
      'tenant:contact_lists:manage',
      'tenant:sources:manage',
      'tenant:staff:round_robin',
      'tenant:deals:view_branch',
      'tenant:deals:create',
      'tenant:deals:update',
      'tenant:appointments:view_branch',
      'tenant:appointments:create',
      'tenant:appointments:update',
      'tenant:appointments:cancel',
      'tenant:invoices:view_branch',
      'tenant:invoices:create',
      'tenant:invoices:send',
      'tenant:payments:record',
    ],
  },
  {
    slug: 'staff',
    name: 'Staff',
    scopeType: 'branch',
    description: 'Create and view within assigned branch; no delete',
    permissionSlugs: [
      'tenant:contacts:view_branch',
      'tenant:contacts:create',
      'tenant:contacts:update',
      'tenant:leads:view_branch',
      'tenant:leads:create',
      'tenant:leads:update',
      'tenant:appointments:view_branch',
      'tenant:appointments:create',
      'tenant:appointments:update',
    ],
  },
  {
    slug: 'viewer',
    name: 'Viewer',
    scopeType: 'branch',
    description: 'Read-only access within assigned branch',
    permissionSlugs: [
      'tenant:contacts:view_branch',
      'tenant:leads:view_branch',
      'tenant:deals:view_branch',
      'tenant:appointments:view_branch',
      'tenant:invoices:view_branch',
    ],
  },
];

/**
 * Core tenant permissions (scope=tenant). Seeded in every tenant regardless of vertical.
 */
export const CORE_TENANT_PERMISSIONS: readonly TenantPermissionSeed[] = [
  // Contacts
  { slug: 'tenant:contacts:view_own', resource: 'contacts', action: 'view_own', description: 'View contacts assigned to me' },
  { slug: 'tenant:contacts:view_branch', resource: 'contacts', action: 'view_branch', description: 'View all contacts in my branch' },
  { slug: 'tenant:contacts:view_all', resource: 'contacts', action: 'view_all', description: 'View all contacts in tenant' },
  { slug: 'tenant:contacts:create', resource: 'contacts', action: 'create', description: 'Create new contacts' },
  { slug: 'tenant:contacts:update', resource: 'contacts', action: 'update', description: 'Update contact records' },
  { slug: 'tenant:contacts:delete', resource: 'contacts', action: 'delete', description: 'Delete contacts' },
  { slug: 'tenant:contacts:export', resource: 'contacts', action: 'export', description: 'Export contacts to CSV/Excel' },
  { slug: 'tenant:contacts:view_pii', resource: 'contacts', action: 'view_pii', description: 'View sensitive PII fields' },
  // Leads / deals
  { slug: 'tenant:leads:view_branch', resource: 'leads', action: 'view_branch', description: 'View leads in branch' },
  { slug: 'tenant:leads:create', resource: 'leads', action: 'create', description: 'Create leads' },
  { slug: 'tenant:leads:update', resource: 'leads', action: 'update', description: 'Update leads' },
  { slug: 'tenant:deals:view_branch', resource: 'deals', action: 'view_branch', description: 'View deals in branch' },
  { slug: 'tenant:deals:create', resource: 'deals', action: 'create', description: 'Create deals' },
  { slug: 'tenant:deals:update', resource: 'deals', action: 'update', description: 'Update deals' },
  // Scheduling
  { slug: 'tenant:appointments:view_branch', resource: 'appointments', action: 'view_branch', description: 'View appointments in branch' },
  { slug: 'tenant:appointments:create', resource: 'appointments', action: 'create', description: 'Book appointments' },
  { slug: 'tenant:appointments:update', resource: 'appointments', action: 'update', description: 'Reschedule appointments' },
  { slug: 'tenant:appointments:cancel', resource: 'appointments', action: 'cancel', description: 'Cancel appointments' },
  // Billing
  { slug: 'tenant:invoices:view_branch', resource: 'invoices', action: 'view_branch', description: 'View invoices in branch' },
  { slug: 'tenant:invoices:create', resource: 'invoices', action: 'create', description: 'Create invoices' },
  { slug: 'tenant:invoices:send', resource: 'invoices', action: 'send', description: 'Send invoices to customers' },
  { slug: 'tenant:invoices:void', resource: 'invoices', action: 'void', description: 'Void invoices' },
  { slug: 'tenant:payments:record', resource: 'payments', action: 'record', description: 'Record payments' },
  // HRM
  { slug: 'tenant:employees:view', resource: 'employees', action: 'view', description: 'View employees' },
  { slug: 'tenant:employees:create', resource: 'employees', action: 'create', description: 'Add employees' },
  { slug: 'tenant:employees:view_salary', resource: 'employees', action: 'view_salary', description: 'View salary information' },
  { slug: 'tenant:payroll:run', resource: 'payroll', action: 'run', description: 'Process payroll' },
  { slug: 'tenant:leaves:approve', resource: 'leaves', action: 'approve', description: 'Approve leave requests' },
  // Admin
  { slug: 'tenant:users:invite', resource: 'users', action: 'invite', description: 'Invite team members' },
  { slug: 'tenant:users:manage_roles', resource: 'users', action: 'manage_roles', description: 'Assign and revoke roles' },
  { slug: 'tenant:settings:manage', resource: 'settings', action: 'manage', description: 'Manage organization settings' },
  { slug: 'tenant:branches:manage', resource: 'branches', action: 'manage', description: 'Create and manage branches' },
  { slug: 'tenant:audit_logs:view', resource: 'audit_logs', action: 'view', description: 'View tenant audit logs' },
  { slug: 'tenant:custom_fields:manage', resource: 'custom_fields', action: 'manage', description: 'Create and manage custom field definitions' },
  // Tags
  { slug: 'tenant:tags:manage', resource: 'tags', action: 'manage', description: 'Create, update, and delete tags' },
  // Contact Lists
  { slug: 'tenant:contact_lists:manage', resource: 'contact_lists', action: 'manage', description: 'Create and manage contact lists' },
  // Sources & Statuses
  { slug: 'tenant:sources:manage', resource: 'sources', action: 'manage', description: 'Create and manage contact sources and lead statuses' },
  // Leads (extended)
  { slug: 'tenant:leads:delete', resource: 'leads', action: 'delete', description: 'Delete leads' },
  { slug: 'tenant:leads:view_all', resource: 'leads', action: 'view_all', description: 'View all leads across tenant' },
  { slug: 'tenant:leads:view_own', resource: 'leads', action: 'view_own', description: 'View leads assigned to me' },
  { slug: 'tenant:leads:convert', resource: 'leads', action: 'convert', description: 'Convert a lead to a contact' },
  // Contacts (extended)
  { slug: 'tenant:contacts:delete', resource: 'contacts', action: 'delete', description: 'Delete contacts' },
  // Lead assignment + webhooks
  { slug: 'tenant:leads:configure', resource: 'leads', action: 'configure', description: 'Configure lead assignment rules and webhooks' },
  { slug: 'tenant:staff:round_robin', resource: 'staff', action: 'round_robin', description: 'Toggle staff round-robin availability' },
];

/**
 * Vertical-specific roles. Merged with CORE_TENANT_ROLES at tenant
 * provisioning time based on the tenant's vertical.
 */
export const VERTICAL_ROLES: Readonly<Record<string, readonly TenantRoleSeed[]>> = {
  medical: [
    {
      slug: 'doctor',
      name: 'Doctor',
      scopeType: 'branch',
      description: 'Clinician with full patient and prescription access',
      permissionSlugs: [
        'tenant:contacts:view_branch',
        'tenant:contacts:view_pii',
        'tenant:appointments:view_branch',
        'medical:patients:view_branch',
        'medical:prescriptions:sign',
        'medical:lab_orders:create',
        'medical:emr:view',
      ],
    },
    {
      slug: 'nurse',
      name: 'Nurse',
      scopeType: 'branch',
      description: 'Patient care support -- vitals, limited EMR',
      permissionSlugs: [
        'tenant:contacts:view_branch',
        'tenant:appointments:view_branch',
        'medical:patients:view_branch',
        'medical:vitals:record',
      ],
    },
    {
      slug: 'receptionist',
      name: 'Receptionist',
      scopeType: 'branch',
      description: 'Front desk -- appointments and basic billing',
      permissionSlugs: [
        'tenant:contacts:view_branch',
        'tenant:contacts:create',
        'tenant:appointments:view_branch',
        'tenant:appointments:create',
        'tenant:appointments:update',
        'tenant:invoices:create',
      ],
    },
  ],
  law: [
    {
      slug: 'partner',
      name: 'Partner',
      scopeType: 'branch',
      description: 'Senior lawyer with full case access',
      permissionSlugs: [
        'tenant:contacts:view_branch',
        'law:cases:view_branch',
        'law:cases:view_confidential',
        'law:billable_hours:edit',
        'law:retainer:withdraw',
      ],
    },
    {
      slug: 'associate',
      name: 'Associate',
      scopeType: 'branch',
      description: 'Practicing lawyer -- case work and billing',
      permissionSlugs: [
        'tenant:contacts:view_branch',
        'law:cases:view_branch',
        'law:billable_hours:edit',
      ],
    },
    {
      slug: 'paralegal',
      name: 'Paralegal',
      scopeType: 'branch',
      description: 'Legal support staff',
      permissionSlugs: [
        'tenant:contacts:view_branch',
        'law:cases:view_branch',
      ],
    },
  ],
  restaurant: [
    {
      slug: 'restaurant_manager',
      name: 'Restaurant Manager',
      scopeType: 'branch',
      description: 'Branch-level management',
      permissionSlugs: [
        'tenant:contacts:view_branch',
        'restaurant:pos:operate',
        'restaurant:menu:edit',
        'restaurant:cash:close_shift',
      ],
    },
    {
      slug: 'waiter',
      name: 'Waiter',
      scopeType: 'branch',
      description: 'Order taking and table service',
      permissionSlugs: ['restaurant:pos:operate'],
    },
    {
      slug: 'chef',
      name: 'Chef',
      scopeType: 'branch',
      description: 'Kitchen display and menu items',
      permissionSlugs: ['restaurant:kitchen:view'],
    },
  ],
  school: [
    {
      slug: 'principal',
      name: 'Principal',
      scopeType: 'branch',
      description: 'School leadership -- full access',
      permissionSlugs: [
        'school:grades:enter',
        'school:grades:finalize',
        'school:fees:waive',
        'school:discipline:record',
      ],
    },
    {
      slug: 'teacher',
      name: 'Teacher',
      scopeType: 'branch',
      description: 'Classroom teacher -- grades and attendance',
      permissionSlugs: ['school:grades:enter'],
    },
  ],
  gym: [
    {
      slug: 'trainer',
      name: 'Trainer',
      scopeType: 'branch',
      description: 'Personal trainer -- sessions and members',
      permissionSlugs: [
        'tenant:contacts:view_branch',
        'gym:trainers:schedule',
      ],
    },
    {
      slug: 'gym_receptionist',
      name: 'Gym Receptionist',
      scopeType: 'branch',
      description: 'Check-ins and membership management',
      permissionSlugs: [
        'tenant:contacts:view_branch',
        'gym:checkin:record',
        'gym:memberships:create',
      ],
    },
  ],
};

/**
 * Vertical-specific permissions. Seeded only when tenant's vertical matches.
 */
export const VERTICAL_TENANT_PERMISSIONS: Readonly<Record<string, readonly TenantPermissionSeed[]>> = {
  medical: [
    { slug: 'medical:patients:view_branch', resource: 'patients', action: 'view_branch', description: 'View patient records in branch' },
    { slug: 'medical:prescriptions:sign', resource: 'prescriptions', action: 'sign', description: 'Sign prescriptions (doctors only)' },
    { slug: 'medical:lab_orders:create', resource: 'lab_orders', action: 'create', description: 'Order lab tests' },
    { slug: 'medical:emr:view', resource: 'emr', action: 'view', description: 'View electronic medical records' },
    { slug: 'medical:vitals:record', resource: 'vitals', action: 'record', description: 'Record patient vitals' },
  ],
  law: [
    { slug: 'law:cases:view_branch', resource: 'cases', action: 'view_branch', description: 'View cases in branch' },
    { slug: 'law:cases:view_confidential', resource: 'cases', action: 'view_confidential', description: 'View confidential case details' },
    { slug: 'law:billable_hours:edit', resource: 'billable_hours', action: 'edit', description: 'Record billable hours' },
    { slug: 'law:retainer:withdraw', resource: 'retainer', action: 'withdraw', description: 'Withdraw from client retainer' },
  ],
  restaurant: [
    { slug: 'restaurant:pos:operate', resource: 'pos', action: 'operate', description: 'Operate point of sale' },
    { slug: 'restaurant:menu:edit', resource: 'menu', action: 'edit', description: 'Edit menu items and pricing' },
    { slug: 'restaurant:kitchen:view', resource: 'kitchen', action: 'view', description: 'View kitchen display system' },
    { slug: 'restaurant:cash:close_shift', resource: 'cash', action: 'close_shift', description: 'Close register shift' },
  ],
  school: [
    { slug: 'school:grades:enter', resource: 'grades', action: 'enter', description: 'Enter student grades' },
    { slug: 'school:grades:finalize', resource: 'grades', action: 'finalize', description: 'Finalize grade sheets' },
    { slug: 'school:fees:waive', resource: 'fees', action: 'waive', description: 'Waive student fees' },
    { slug: 'school:discipline:record', resource: 'discipline', action: 'record', description: 'Record disciplinary actions' },
  ],
  gym: [
    { slug: 'gym:checkin:record', resource: 'checkin', action: 'record', description: 'Record member check-ins' },
    { slug: 'gym:memberships:create', resource: 'memberships', action: 'create', description: 'Create memberships' },
    { slug: 'gym:trainers:schedule', resource: 'trainers', action: 'schedule', description: 'Schedule trainer sessions' },
  ],
};

export const DEFAULT_BRANCH_NAME = 'Main';
export const DEFAULT_BRANCH_CODE = 'MAIN-01';

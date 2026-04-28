import { Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { BosConfigModule, crmCoreEnvSchema } from '@bos/config';
import { BosLoggerModule } from '@bos/logger';
import { BosSecurityModule } from '@bos/security';
import { BosHealthModule } from '@bos/health';
import { BosRedisModule } from '@bos/redis';
import { BosDatabaseModule } from '@bos/database';
import { BosAuthClientModule, PERMISSION_RESOLVER } from '@bos/auth-client';
import { BosQueueModule } from '@bos/queue';
import { TenantModule } from './modules/tenant/tenant.module';
import { StaffModule } from './modules/staff/staff.module';
import { BranchesModule } from './modules/branches/branches.module';
import { RolesModule } from './modules/roles/roles.module';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module';
import { TagsModule } from './modules/tags/tags.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { LeadsModule } from './modules/leads/leads.module';
import { LeadAssignmentModule } from './modules/lead-assignment/lead-assignment.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { LeadActivitiesModule } from './modules/lead-activities/lead-activities.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TenantPermissionResolverService } from './common/services/permission-resolver.service';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const logLevel = process.env.LOG_LEVEL ?? 'info';
const isProd = nodeEnv === 'production';

const publicKeyPath = resolve(
  process.cwd(),
  process.env.AUTH_JWT_PUBLIC_KEY_PATH ?? './keys/jwt-public.pem',
);

@Module({
  imports: [
    BosConfigModule.forRoot({ schema: crmCoreEnvSchema }),
    BosLoggerModule.forRoot({
      serviceName: 'crm-core',
      nodeEnv,
      logLevel,
    }),
    BosSecurityModule.forRoot({
      isProd,
      throttle: {
        ttl:   Number(process.env.THROTTLE_TTL   ?? 60),
        limit: Number(process.env.THROTTLE_LIMIT ?? 1000),
      },
    }),
    BosRedisModule.forRoot(),
    BosDatabaseModule.forRoot({ enableCore: true, enableTenant: true }),
    BosAuthClientModule.forRoot({
      publicKeyPath,
      algorithm: process.env.AUTH_JWT_ALGORITHM ?? 'RS256',
    }),
    BosQueueModule.forRoot(),
    BosHealthModule,
    TenantModule,
    StaffModule,
    BranchesModule,
    RolesModule,
    CustomFieldsModule,
    TagsModule,
    ContactsModule,
    LeadsModule,
    LeadAssignmentModule,
    WebhooksModule,
    LeadActivitiesModule,
    TasksModule,
  ],
  providers: [
    TenantPermissionResolverService,
    // PERMISSION_RESOLVER alias — discovered at runtime by PermissionsGuard via
    // ModuleRef.get(PERMISSION_RESOLVER, { strict: false }) across the full app context.
    { provide: PERMISSION_RESOLVER, useExisting: TenantPermissionResolverService },
  ],
})
export class AppModule {}

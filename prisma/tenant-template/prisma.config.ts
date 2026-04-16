import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Tenant template config — uses bos_core URL, but migrations are applied
 * per-tenant at runtime with a `?schema=tenant_{uuid}` override, not via
 * `prisma migrate dev`. See TenantSchemaManager in libs/database.
 */
export default defineConfig({
  schema: 'schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL_CORE,
  },
  migrations: {
    path: 'migrations',
  },
});

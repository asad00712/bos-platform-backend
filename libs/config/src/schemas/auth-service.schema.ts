import Joi from 'joi';
import { baseEnvSchema } from './base.schema';
import { redisEnvSchema } from './redis.schema';
import { coreDbEnvSchema, volatileDbEnvSchema } from './database.schema';

export const authServiceEnvSchema = baseEnvSchema
  .concat(redisEnvSchema)
  .concat(coreDbEnvSchema)
  .concat(volatileDbEnvSchema)
  .concat(
    Joi.object({
      AUTH_SERVICE_PORT: Joi.number().port().default(3001),

      // Frontend base URL — used to build email links (verify, reset password, invite)
      APP_FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

      // Resend transactional email
      RESEND_API_KEY: Joi.string().required(),

      // JWT
      AUTH_JWT_PRIVATE_KEY_PATH: Joi.string().required(),
      AUTH_JWT_PUBLIC_KEY_PATH: Joi.string().required(),
      AUTH_JWT_ALGORITHM: Joi.string().valid('RS256', 'RS384', 'RS512').default('RS256'),
      AUTH_JWT_ACCESS_TTL: Joi.number().integer().positive().default(900),
      AUTH_JWT_REFRESH_TTL: Joi.number().integer().positive().default(2_592_000),
      AUTH_JWT_PLATFORM_ACCESS_TTL: Joi.number().integer().positive().default(300),

      // Password & lockout
      AUTH_BCRYPT_COST: Joi.number().integer().min(10).max(15).default(12),
      AUTH_LOCKOUT_MAX_ATTEMPTS: Joi.number().integer().positive().default(10),
      AUTH_LOCKOUT_DURATION: Joi.number().integer().positive().default(1800),

      // Token TTLs
      AUTH_INVITE_TTL: Joi.number().integer().positive().default(172_800),
      AUTH_EMAIL_VERIFY_TTL: Joi.number().integer().positive().default(86_400),
      AUTH_PASSWORD_RESET_TTL: Joi.number().integer().positive().default(3600),
      AUTH_2FA_TEMP_TOKEN_TTL: Joi.number().integer().positive().default(300),

      // SSO (optional at runtime; only required when SSO is enabled)
      GOOGLE_OAUTH_CLIENT_ID: Joi.string().allow('').optional(),
      GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().allow('').optional(),
      GOOGLE_OAUTH_CALLBACK_URL: Joi.string().uri().allow('').optional(),
      MICROSOFT_OAUTH_CLIENT_ID: Joi.string().allow('').optional(),
      MICROSOFT_OAUTH_CLIENT_SECRET: Joi.string().allow('').optional(),
      MICROSOFT_OAUTH_TENANT_ID: Joi.string().default('common'),
      MICROSOFT_OAUTH_CALLBACK_URL: Joi.string().uri().allow('').optional(),
    }),
  );

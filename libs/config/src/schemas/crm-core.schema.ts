import Joi from 'joi';
import { baseEnvSchema } from './base.schema';
import { redisEnvSchema } from './redis.schema';
import { coreDbEnvSchema } from './database.schema';

export const crmCoreEnvSchema = baseEnvSchema
  .concat(redisEnvSchema)
  .concat(coreDbEnvSchema)
  .concat(
    Joi.object({
      CRM_CORE_PORT: Joi.number().port().default(3002),
      APP_FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
    }),
  );

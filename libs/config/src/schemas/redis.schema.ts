import Joi from 'joi';

export const redisEnvSchema = Joi.object({
  // Redis 1 — Operational (JWT revocation, rate limits, sessions, pub/sub, cache)
  REDIS_HOST:     Joi.string().hostname().required(),
  REDIS_PORT:     Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB:       Joi.number().integer().min(0).max(15).default(0),

  // Redis 2 — Transactional Queue (auth emails, notifications, webhooks, AI leads)
  REDIS_QUEUE_TRANSACTIONAL_HOST:     Joi.string().hostname().default('localhost'),
  REDIS_QUEUE_TRANSACTIONAL_PORT:     Joi.number().port().default(6380),
  REDIS_QUEUE_TRANSACTIONAL_PASSWORD: Joi.string().allow('').optional(),

  // Redis 3 — Heavy Queue (campaigns, workflows, bulk imports)
  REDIS_QUEUE_HEAVY_HOST:     Joi.string().hostname().default('localhost'),
  REDIS_QUEUE_HEAVY_PORT:     Joi.number().port().default(6381),
  REDIS_QUEUE_HEAVY_PASSWORD: Joi.string().allow('').optional(),
});

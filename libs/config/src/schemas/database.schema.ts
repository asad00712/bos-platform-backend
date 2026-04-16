import Joi from 'joi';

export const coreDbEnvSchema = Joi.object({
  DATABASE_URL_CORE: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
});

export const volatileDbEnvSchema = Joi.object({
  DATABASE_URL_VOLATILE: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
});

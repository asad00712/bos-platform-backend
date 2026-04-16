import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type Joi from 'joi';

export interface BosConfigOptions {
  schema: Joi.ObjectSchema;
  envFiles?: string[];
}

@Module({})
export class BosConfigModule {
  static forRoot(options: BosConfigOptions): DynamicModule {
    return {
      module: BosConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          envFilePath: options.envFiles ?? ['.env.local', '.env'],
          validationSchema: options.schema,
          validationOptions: {
            abortEarly: false,
            allowUnknown: true,
          },
          expandVariables: true,
        }),
      ],
      exports: [ConfigModule],
    };
  }
}

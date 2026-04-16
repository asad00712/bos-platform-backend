import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';
import { REDIS_CLIENT, REDIS_SUBSCRIBER } from './redis.constants';
import { RedisService } from './redis.service';

export interface BosRedisModuleOptions {
  /** If true, also provide a dedicated subscriber client (needed for Pub/Sub). Default: false. */
  withSubscriber?: boolean;
}

function toOptionalString(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function buildRedisOptions(config: ConfigService): RedisOptions {
  return {
    host: config.getOrThrow<string>('REDIS_HOST'),
    port: config.getOrThrow<number>('REDIS_PORT'),
    password: toOptionalString(config.get<string>('REDIS_PASSWORD')),
    db: config.get<number>('REDIS_DB', 0),
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times: number): number => Math.min(times * 200, 2000),
    reconnectOnError: (err: Error): boolean => {
      const targetError = 'READONLY';
      return err.message.includes(targetError);
    },
  };
}

@Global()
@Module({})
export class BosRedisModule {
  static forRoot(options: BosRedisModuleOptions = {}): DynamicModule {
    const providers = [
      {
        provide: REDIS_CLIENT,
        useFactory: (config: ConfigService): Redis => new Redis(buildRedisOptions(config)),
        inject: [ConfigService],
      },
      RedisService,
    ];

    if (options.withSubscriber) {
      providers.push({
        provide: REDIS_SUBSCRIBER,
        useFactory: (config: ConfigService): Redis => new Redis(buildRedisOptions(config)),
        inject: [ConfigService],
      });
    }

    return {
      module: BosRedisModule,
      providers,
      exports: [
        REDIS_CLIENT,
        RedisService,
        ...(options.withSubscriber ? [REDIS_SUBSCRIBER] : []),
      ],
    };
  }
}

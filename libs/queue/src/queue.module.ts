import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_CONN_MAP, type QueueName, type QueueConfigKey } from './queue.constants';

/**
 * BOS queue module wrapping `@nestjs/bullmq`.
 *
 * Usage:
 *   // In AppModule (once, globally):
 *   BosQueueModule.forRoot()
 *
 *   // In feature modules (to inject Queue<T>):
 *   BosQueueModule.forFeature([{ name: QUEUE_NAMES.MAIL }])
 */
@Global()
@Module({})
export class BosQueueModule {
  /**
   * Registers TWO BullMQ connections:
   *   'transactional' → REDIS_QUEUE_TRANSACTIONAL_* (auth emails, notifications, webhooks, AI)
   *   'heavy'         → REDIS_QUEUE_HEAVY_*         (campaigns, workflows, bulk imports)
   *
   * Call once at AppModule level.
   */
  static forRoot(): DynamicModule {
    const transactionalDefaults = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 }, // 2→4→8s
      removeOnComplete: { count: 1_000 },
      removeOnFail:     { count: 5_000 },
    };

    const heavyDefaults = {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 }, // 5→10→20→40→80s
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 10_000 },
    };

    return {
      module: BosQueueModule,
      imports: [
        BullModule.forRootAsync('transactional', {
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: {
              host:     config.getOrThrow<string>('REDIS_QUEUE_TRANSACTIONAL_HOST'),
              port:     config.getOrThrow<number>('REDIS_QUEUE_TRANSACTIONAL_PORT'),
              password: config.get<string>('REDIS_QUEUE_TRANSACTIONAL_PASSWORD') || undefined,
            },
            defaultJobOptions: transactionalDefaults,
          }),
        }),
        BullModule.forRootAsync('heavy', {
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: {
              host:     config.getOrThrow<string>('REDIS_QUEUE_HEAVY_HOST'),
              port:     config.getOrThrow<number>('REDIS_QUEUE_HEAVY_PORT'),
              password: config.get<string>('REDIS_QUEUE_HEAVY_PASSWORD') || undefined,
            },
            defaultJobOptions: heavyDefaults,
          }),
        }),
      ],
      exports: [BullModule],
    };
  }

  /**
   * Registers named queues for a feature module.
   * Automatically routes each queue to the correct Redis connection via QUEUE_CONN_MAP.
   *
   * Usage: BosQueueModule.forFeature([{ name: QUEUE_NAMES.MAIL }])
   */
  static forFeature(queues: Array<{ name: QueueName }>): DynamicModule {
    const opts = queues.map(q => ({
      name:      q.name,
      configKey: QUEUE_CONN_MAP[q.name] satisfies QueueConfigKey,
    }));
    return {
      module: BosQueueModule,
      imports: [BullModule.registerQueue(...opts)],
      exports: [BullModule],
    };
  }
}

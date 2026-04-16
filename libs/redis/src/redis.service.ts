import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT, REDIS_SUBSCRIBER } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) public readonly client: Redis,
    @Optional() @Inject(REDIS_SUBSCRIBER) public readonly subscriber?: Redis,
  ) {}

  async ping(): Promise<boolean> {
    const result = await this.client.ping();
    return result === 'PONG';
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => undefined);
    }
  }
}

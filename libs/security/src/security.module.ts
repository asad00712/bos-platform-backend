import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { PasswordHasherService } from './crypto/password-hasher.service';

export interface BosSecurityModuleOptions {
  isProd: boolean;
  throttle?: {
    ttl: number;
    limit: number;
  };
  requestTimeoutMs?: number;
}

@Module({})
export class BosSecurityModule implements NestModule {
  static forRoot(options: BosSecurityModuleOptions): DynamicModule {
    const timeoutMs = options.requestTimeoutMs ?? 30_000;
    return {
      module: BosSecurityModule,
      global: true,
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: (options.throttle?.ttl ?? 60) * 1000,
            limit: options.throttle?.limit ?? 1000,
          },
        ]),
      ],
      providers: [
        {
          provide: APP_FILTER,
          useValue: new AllExceptionsFilter(options.isProd),
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: TransformInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useValue: new TimeoutInterceptor(timeoutMs),
        },
        {
          provide: 'APP_GUARD_THROTTLER',
          useClass: ThrottlerGuard,
        },
        PasswordHasherService,
      ],
      exports: [ThrottlerModule, PasswordHasherService],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*path');
  }
}

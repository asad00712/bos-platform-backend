import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  RESEND_CLIENT,
  MAILER_FROM_NAME,
  MAILER_FROM_ADDR,
  DEFAULT_FROM_NAME,
  DEFAULT_FROM_ADDRESS,
} from './mailer.constants';
import { MailerService } from './mailer.service';

/**
 * BOS mailer module — provides `MailerService` globally.
 *
 * Requires `RESEND_API_KEY` env var.
 * Call `BosMailerModule.forRoot()` once in AppModule.
 */
@Global()
@Module({})
export class BosMailerModule {
  static forRoot(): DynamicModule {
    return {
      module: BosMailerModule,
      providers: [
        {
          provide:    RESEND_CLIENT,
          inject:     [ConfigService],
          useFactory: (config: ConfigService): Resend => {
            const apiKey = config.getOrThrow<string>('RESEND_API_KEY');
            return new Resend(apiKey);
          },
        },
        {
          provide:    MAILER_FROM_NAME,
          inject:     [ConfigService],
          useFactory: (config: ConfigService): string =>
            config.get<string>('MAILER_FROM_NAME', DEFAULT_FROM_NAME),
        },
        {
          provide:    MAILER_FROM_ADDR,
          inject:     [ConfigService],
          useFactory: (config: ConfigService): string =>
            config.get<string>('MAILER_FROM_ADDRESS', DEFAULT_FROM_ADDRESS),
        },
        MailerService,
      ],
      exports: [MailerService],
    };
  }
}

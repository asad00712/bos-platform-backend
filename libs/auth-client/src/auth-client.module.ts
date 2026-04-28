import {
  DynamicModule,
  Global,
  Module,
  Provider,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import {
  JwtVerifierService,
  type JwtVerifierOptions,
} from './services/jwt-verifier.service';
import { TokenRevocationService } from './services/token-revocation.service';

export interface BosAuthClientModuleOptions {
  /** Absolute path to JWT public key PEM. */
  publicKeyPath: string;
  /** JWT signing algorithm — match what auth-service issues. Default 'RS256'. */
  algorithm?: string;
  /** JWT issuer claim — default 'bos-auth'. */
  issuer?: string;
  /** JWT audience claim — default 'bos-platform'. */
  audience?: string;
  /** Register JwtAuthGuard + PermissionsGuard as global APP_GUARDs. Default true. */
  registerGlobalGuards?: boolean;
}

/**
 * Mount in every service that accepts JWTs (including auth-service for
 * `/logout`, `/refresh`, `/me` — but auth-service ALSO has its own
 * token-issuance service that signs with the PRIVATE key; this lib is
 * validation-only).
 */
@Global()
@Module({})
export class BosAuthClientModule {
  static forRoot(options: BosAuthClientModuleOptions): DynamicModule {
    const verifierOptions: JwtVerifierOptions = {
      publicKeyPath: options.publicKeyPath,
      algorithm: options.algorithm ?? 'RS256',
      issuer: options.issuer ?? 'bos-auth',
      audience: options.audience ?? 'bos-platform',
    };

    const providers: Provider[] = [
      {
        provide: JwtVerifierService,
        useFactory: (_config: ConfigService): JwtVerifierService =>
          new JwtVerifierService(verifierOptions),
        inject: [ConfigService],
      },
      TokenRevocationService,
    ];

    if (options.registerGlobalGuards !== false) {
      providers.push(
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        // PermissionsGuard runs AFTER JwtAuthGuard (same module = same init order).
        // It uses ModuleRef.get(PERMISSION_RESOLVER, { strict: false }) at runtime
        // to locate the resolver from any module in the app, bypassing DI scoping.
        { provide: APP_GUARD, useClass: PermissionsGuard },
      );
    }

    return {
      module: BosAuthClientModule,
      imports: [ConfigModule],
      providers,
      exports: [JwtVerifierService, TokenRevocationService],
    };
  }
}

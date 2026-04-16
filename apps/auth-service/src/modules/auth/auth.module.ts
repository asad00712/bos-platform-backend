import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BosQueueModule, QUEUE_NAMES } from '@bos/queue';
import { AuthController } from './auth.controller';
import { SessionsRepository } from './repositories/sessions.repository';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { TokenIssuerService } from './services/token-issuer.service';
import { SignupService } from './services/signup.service';
import { LoginService } from './services/login.service';
import { RefreshService } from './services/refresh.service';
import { LogoutService } from './services/logout.service';
import { EmailVerifyService } from './services/email-verify.service';
import { PasswordResetService } from './services/password-reset.service';
import { TwoFactorService } from './services/two-factor.service';

@Module({
  imports: [UsersModule, BosQueueModule.forFeature([{ name: QUEUE_NAMES.MAIL }])],
  controllers: [AuthController],
  providers: [
    SessionsRepository,
    RefreshTokensRepository,
    TokenIssuerService,
    SignupService,
    LoginService,
    RefreshService,
    LogoutService,
    EmailVerifyService,
    PasswordResetService,
    TwoFactorService,
  ],
  exports: [TokenIssuerService, SessionsRepository, RefreshTokensRepository],
})
export class AuthModule {}

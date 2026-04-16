import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { REFRESH_TOKEN_COOKIE } from '@bos/common';
import {
  CurrentUser,
  Public,
  JwtVerifierService,
  type AuthenticatedUser,
} from '@bos/auth-client';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import {
  LoginResponseDto,
  RefreshResponseDto,
  SignupResponseDto,
} from './dto/auth-response.dto';
import {
  VerifyEmailDto,
  ResendVerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  TwoFactorCodeDto,
  TwoFactorVerifyLoginDto,
  TwoFactorSetupResponseDto,
} from './dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { SignupService } from './services/signup.service';
import { LoginService } from './services/login.service';
import { RefreshService } from './services/refresh.service';
import { LogoutService } from './services/logout.service';
import { EmailVerifyService } from './services/email-verify.service';
import { PasswordResetService } from './services/password-reset.service';
import { TwoFactorService } from './services/two-factor.service';
import { UsersService } from '../users/users.service';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly signup: SignupService,
    private readonly login: LoginService,
    private readonly refresh: RefreshService,
    private readonly logout: LogoutService,
    private readonly emailVerify: EmailVerifyService,
    private readonly passwordReset: PasswordResetService,
    private readonly twoFactor: TwoFactorService,
    private readonly users: UsersService,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  // ===========================
  // Signup
  // ===========================

  @Public()
  @Post('signup')
  @Throttle({ default: { ttl: 3_600_000, limit: 3 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Self-serve organization owner signup' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, type: SignupResponseDto })
  @ApiResponse({ status: 409, description: 'Email or tenant slug already exists' })
  @ApiResponse({ status: 422, description: 'Validation error or password policy violation' })
  async signupHandler(@Body() dto: SignupDto): Promise<SignupResponseDto> {
    const result = await this.signup.execute(dto);
    const user = await this.users.findByIdOrThrow(result.userId);
    return {
      user: UserResponseDto.fromEntity(user),
      tenantId: result.tenantId,
      tenantSlug: result.tenantSlug,
      nextStep: 'EMAIL_VERIFICATION_REQUIRED',
    };
  }

  // ===========================
  // Login
  // ===========================

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Password login — returns JWT + refresh, or 2FA challenge' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Email not verified / account suspended' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  async loginHandler(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.login.execute({
      email: dto.email,
      password: dto.password,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] ?? null,
    });

    if (result.requires2FA) {
      return {
        accessToken: result.tempToken,
        accessTokenExpiresIn: Math.max(
          0,
          Math.floor((result.tempTokenExpiresAt.getTime() - Date.now()) / 1000),
        ),
        accessTokenExpiresAt: result.tempTokenExpiresAt.toISOString(),
        requires2FA: true,
        user: UserResponseDto.fromEntity(
          await this.users.findByEmailOrThrow(dto.email),
        ),
      };
    }

    this.setRefreshCookie(res, result.refreshTokenRaw, result.refreshTokenExpiresAt);

    return {
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
      accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
      requires2FA: false,
      user: UserResponseDto.fromEntity(result.user),
    };
  }

  // ===========================
  // Token refresh + logout
  // ===========================

  @Public()
  @Post('refresh')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token → issue new access + refresh' })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  @ApiResponse({ status: 401, description: 'Missing, invalid, expired, revoked, or reused refresh token' })
  async refreshHandler(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_TOKEN_COOKIE];
    if (!raw) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const result = await this.refresh.execute(raw);
    this.setRefreshCookie(res, result.refreshTokenRaw, result.refreshTokenExpiresAt);
    return {
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
      accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
    };
  }

  @Post('logout')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End current session' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logoutHandler(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshRaw =
      (req.cookies as Record<string, string> | undefined)?.[REFRESH_TOKEN_COOKIE] ?? null;

    await this.logout.logoutCurrent({
      sessionId: user.sessionId,
      accessJti: user.jti,
      rawRefreshToken: refreshRaw,
    });

    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  }

  @Post('logout-all')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End ALL sessions for the current user' })
  @ApiResponse({ status: 204, description: 'All sessions terminated' })
  async logoutAllHandler(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.logout.logoutAll(user.userId);
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  }

  // ===========================
  // Email verification
  // ===========================

  @Public()
  @Post('verify-email')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address using the token from the signup email' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified; tenant schema provisioned' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired' })
  @ApiResponse({ status: 409, description: 'Email already verified' })
  async verifyEmailHandler(@Body() dto: VerifyEmailDto): Promise<{ message: string }> {
    await this.emailVerify.execute(dto.token);
    return { message: 'Email verified successfully. You may now log in.' };
  }

  @Public()
  @Post('resend-verify-email')
  @Throttle({ default: { ttl: 3_600_000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification token' })
  @ApiBody({ type: ResendVerifyEmailDto })
  @ApiResponse({ status: 200, description: 'If the address is registered and unverified, a new token has been sent' })
  async resendVerifyEmailHandler(@Body() dto: ResendVerifyEmailDto): Promise<{ message: string }> {
    // Suppress all errors — account enumeration protection.
    try {
      await this.emailVerify.resend(dto.email);
    } catch {
      // Swallow UserAlreadyVerifiedException and any other error.
    }
    return { message: 'If the address is registered and unverified, a new verification email has been sent.' };
  }

  // ===========================
  // Password reset
  // ===========================

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { ttl: 3_600_000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Reset email sent (if address is registered)' })
  async forgotPasswordHandler(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    // Service is silent when email not found — prevents enumeration.
    await this.passwordReset.requestReset(dto.email);
    return { message: 'If that email is registered, a password reset link has been sent.' };
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using the token from the reset email' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password updated; all sessions terminated' })
  @ApiResponse({ status: 400, description: 'Token invalid/expired or password too weak' })
  async resetPasswordHandler(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.passwordReset.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password updated. Please log in with your new password.' };
  }

  // ===========================
  // Two-factor authentication
  // ===========================

  @Post('2fa/setup')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Begin 2FA enrollment — returns secret + QR URI + backup codes' })
  @ApiResponse({ status: 200, type: TwoFactorSetupResponseDto })
  @ApiResponse({ status: 409, description: '2FA already enabled' })
  async twoFactorSetupHandler(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorSetupResponseDto> {
    return this.twoFactor.beginSetup(user.userId);
  }

  @Post('2fa/confirm')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm 2FA enrollment with a valid TOTP code' })
  @ApiBody({ type: TwoFactorCodeDto })
  @ApiResponse({ status: 204, description: '2FA activated' })
  @ApiResponse({ status: 400, description: 'Invalid TOTP code or setup not started' })
  async twoFactorConfirmHandler(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<void> {
    await this.twoFactor.confirmSetup(user.userId, dto.code);
  }

  @Post('2fa/disable')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disable 2FA — requires current TOTP code to confirm' })
  @ApiBody({ type: TwoFactorCodeDto })
  @ApiResponse({ status: 204, description: '2FA disabled' })
  @ApiResponse({ status: 400, description: '2FA not enabled or invalid code' })
  async twoFactorDisableHandler(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<void> {
    await this.twoFactor.disable(user.userId, dto.code);
  }

  @Public()
  @Post('2fa/verify')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete 2FA login — provide TOTP code after receiving 2fa_pending token' })
  @ApiBody({ type: TwoFactorVerifyLoginDto })
  @ApiResponse({ status: 200, description: 'Full access + refresh token issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired 2FA code' })
  async twoFactorVerifyHandler(
    @Body() dto: TwoFactorVerifyLoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    // @Public() skips the JwtAuthGuard so req.user is never set here.
    // Manually verify the 2fa_pending token from the Authorization header.
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const rawToken = authHeader.slice(7);
    let claims: Awaited<ReturnType<JwtVerifierService['verify']>>;
    try {
      claims = await this.jwtVerifier.verify(rawToken);
    } catch {
      throw new UnauthorizedException('Missing or invalid 2fa_pending token');
    }
    if (claims.scope !== 'two_factor_pending') {
      throw new UnauthorizedException('Missing or invalid 2fa_pending token');
    }

    const result = await this.twoFactor.verifyLogin(
      claims.sub,
      claims.sessionId,
      dto.code,
      ip,
    );

    this.setRefreshCookie(res, result.refreshTokenRaw, result.refreshTokenExpiresAt);

    return {
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
      accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
      requires2FA: false,
      user: UserResponseDto.fromEntity(await this.users.findByIdOrThrow(claims.sub)),
    };
  }

  @Post('2fa/backup-codes/regenerate')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate 2FA backup codes — requires current TOTP' })
  @ApiBody({ type: TwoFactorCodeDto })
  @ApiResponse({ status: 200, description: '10 new backup codes — shown once' })
  async twoFactorRegenerateBackupCodesHandler(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<{ backupCodes: string[] }> {
    const codes = await this.twoFactor.regenerateBackupCodes(user.userId, dto.code);
    return { backupCodes: codes };
  }

  // ===========================
  // Me (current user profile)
  // ===========================

  @Get('me')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async meHandler(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    const u = await this.users.findByIdOrThrow(user.userId);
    return UserResponseDto.fromEntity(u);
  }

  // ---------------------------------------------------------------------------

  private setRefreshCookie(res: Response, raw: string, expiresAt: Date): void {
    res.cookie(REFRESH_TOKEN_COOKIE, raw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      expires: expiresAt,
    });
  }
}

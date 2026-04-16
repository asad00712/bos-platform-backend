import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class TwoFactorCodeDto {
  @ApiProperty({ description: '6-digit TOTP code or 8-char uppercase backup code', example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  code!: string;
}

export class TwoFactorVerifyLoginDto {
  @ApiProperty({ description: '6-digit TOTP or backup code', example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  code!: string;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty({ description: 'Base32 TOTP secret — store in authenticator app' })
  secret!: string;

  @ApiProperty({ description: 'otpauth:// URI — encode as QR code for authenticator app' })
  otpauthUrl!: string;

  @ApiProperty({ description: '10 single-use backup codes — shown exactly once', type: [String] })
  backupCodes!: string[];
}

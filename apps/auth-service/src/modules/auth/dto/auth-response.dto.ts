import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class TokenPairDto {
  @ApiProperty({ description: 'JWT access token — short-lived' })
  accessToken!: string;

  @ApiProperty({ type: Number, description: 'Access token TTL in seconds' })
  accessTokenExpiresIn!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  accessTokenExpiresAt!: string;
}

export class LoginResponseDto extends TokenPairDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({
    type: Boolean,
    description: 'True when the call requires submitting a TOTP code next. accessToken is a scoped temp token in that case.',
  })
  requires2FA!: boolean;
}

export class SignupResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({ format: 'uuid', description: 'The newly-provisioned tenant id' })
  tenantId!: string;

  @ApiProperty({ example: 'acme-clinic' })
  tenantSlug!: string;

  @ApiProperty({
    type: String,
    description: 'Next step — user must verify email before first login',
    example: 'EMAIL_VERIFICATION_REQUIRED',
  })
  nextStep!: 'EMAIL_VERIFICATION_REQUIRED';
}

export class RefreshResponseDto extends TokenPairDto {}

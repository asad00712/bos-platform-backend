import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: '64-char hex token from the verification email',
    example: 'a1b2c3d4...',
    minLength: 64,
    maxLength: 64,
  })
  @IsString()
  @Length(64, 64)
  token!: string;
}

export class ResendVerifyEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}

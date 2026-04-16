import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: '64-char hex reset token from the email',
    example: 'a1b2c3d4...',
    minLength: 64,
    maxLength: 64,
  })
  @IsString()
  @Length(64, 64)
  token!: string;

  @ApiProperty({
    example: 'NewS3cureP@ssword!',
    minLength: 10,
    maxLength: 128,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  newPassword!: string;
}

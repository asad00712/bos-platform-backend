import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MinLength, MaxLength } from 'class-validator';

export class InviteAcceptDto {
  @ApiProperty({
    description: '64-char hex invite token from the invite email',
    example: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    minLength: 64,
    maxLength: 64,
  })
  @IsString()
  @Length(64, 64)
  token!: string;

  @ApiProperty({
    description: 'Password to set for this account',
    example: 'SecureP@ssword123!',
    minLength: 10,
    maxLength: 128,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;
}

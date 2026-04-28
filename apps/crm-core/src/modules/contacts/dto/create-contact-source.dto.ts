import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactSourceDto {
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty({ example: 'Facebook Ads' }) @IsString() @MinLength(1) @MaxLength(100) name!: string;
}

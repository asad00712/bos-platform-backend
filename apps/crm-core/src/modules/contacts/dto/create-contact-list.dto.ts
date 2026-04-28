import { IsString, IsUUID, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactListDto {
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty({ example: 'VIP Clients' }) @IsString() @MinLength(1) @MaxLength(150) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class AddContactsToListDto {
  @ApiProperty({ type: [String], description: 'Array of contact UUIDs to add' })
  contactIds!: string[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeadDto {
  @ApiProperty() id!: string;
  @ApiProperty() branchId!: string;
  @ApiPropertyOptional() contactId!: string | null;
  @ApiProperty() firstName!: string;
  @ApiPropertyOptional() lastName!: string | null;
  @ApiPropertyOptional() email!: string | null;
  @ApiPropertyOptional() phone!: string | null;
  @ApiPropertyOptional() company!: string | null;
  @ApiPropertyOptional() sourceId!: string | null;
  @ApiPropertyOptional() statusId!: string | null;
  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH'] }) priority!: string;
  @ApiPropertyOptional() estimatedValue!: number | null;
  @ApiPropertyOptional() ownedByUserId!: string | null;
  @ApiPropertyOptional() notes!: string | null;
  @ApiPropertyOptional() convertedAt!: Date | null;
  @ApiPropertyOptional() convertedByUserId!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class LeadListResponseDto {
  @ApiProperty({ type: [LeadDto] }) data!: LeadDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class LeadStatusDto {
  @ApiProperty() id!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() color!: string | null;
  @ApiProperty() displayOrder!: number;
  @ApiProperty() isSystem!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class LeadStatusListDto {
  @ApiProperty({ type: [LeadStatusDto] }) data!: LeadStatusDto[];
  @ApiProperty() total!: number;
}

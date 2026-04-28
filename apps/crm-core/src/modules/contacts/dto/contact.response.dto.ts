import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContactDto {
  @ApiProperty() id!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() firstName!: string;
  @ApiPropertyOptional() lastName!: string | null;
  @ApiPropertyOptional() email!: string | null;
  @ApiPropertyOptional() phone!: string | null;
  @ApiPropertyOptional() company!: string | null;
  @ApiPropertyOptional() jobTitle!: string | null;
  @ApiPropertyOptional() address!: string | null;
  @ApiPropertyOptional() city!: string | null;
  @ApiPropertyOptional() state!: string | null;
  @ApiPropertyOptional() country!: string | null;
  @ApiPropertyOptional() postalCode!: string | null;
  @ApiPropertyOptional() sourceId!: string | null;
  @ApiPropertyOptional() originLeadId!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] }) status!: string;
  @ApiPropertyOptional() ownedByUserId!: string | null;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ContactListResponseDto {
  @ApiProperty({ type: [ContactDto] }) data!: ContactDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class ContactSourceDto {
  @ApiProperty() id!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isSystem!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ContactSourceListDto {
  @ApiProperty({ type: [ContactSourceDto] }) data!: ContactSourceDto[];
  @ApiProperty() total!: number;
}

export class ContactListDto {
  @ApiProperty() id!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty({ enum: ['STATIC'] }) listType!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() memberCount!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ContactListListDto {
  @ApiProperty({ type: [ContactListDto] }) data!: ContactListDto[];
  @ApiProperty() total!: number;
}

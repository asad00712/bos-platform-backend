import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SelectOptionResponseDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  value!: string;
}

export class CustomFieldDefinitionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['CONTACT', 'DEAL'] })
  entityType!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  fieldType!: string;

  @ApiProperty()
  isRequired!: boolean;

  @ApiProperty({ type: [SelectOptionResponseDto] })
  options!: SelectOptionResponseDto[];

  @ApiPropertyOptional({ nullable: true })
  defaultValue!: string | null;

  @ApiPropertyOptional({ nullable: true })
  placeholder!: string | null;

  @ApiProperty()
  displayOrder!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CustomFieldListResponseDto {
  @ApiProperty({ type: [CustomFieldDefinitionDto] })
  data!: CustomFieldDefinitionDto[];

  @ApiProperty()
  total!: number;
}

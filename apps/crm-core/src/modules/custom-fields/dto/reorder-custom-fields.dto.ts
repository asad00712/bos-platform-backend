import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FieldOrderItemDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  displayOrder!: number;
}

export class ReorderCustomFieldsDto {
  @ApiProperty({ type: [FieldOrderItemDto], minItems: 1, maxItems: 200 })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldOrderItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  fields!: FieldOrderItemDto[];
}

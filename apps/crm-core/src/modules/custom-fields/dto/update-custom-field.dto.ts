import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SelectOptionDto } from './create-custom-field.dto';

export class UpdateCustomFieldDto {
  @ApiPropertyOptional({ example: 'Lead Source' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ type: [SelectOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectOptionDto)
  @ArrayMaxSize(100)
  options?: SelectOptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;
}

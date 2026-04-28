import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BranchDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiPropertyOptional()
  address?: string | null;

  @ApiPropertyOptional()
  city?: string | null;

  @ApiPropertyOptional()
  state?: string | null;

  @ApiPropertyOptional()
  country?: string | null;

  @ApiPropertyOptional()
  postalCode?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiProperty()
  timezone!: string;

  @ApiPropertyOptional()
  parentBranchId?: string | null;

  @ApiProperty()
  isHeadOffice!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ type: [Object], description: 'Child branches (populated when requested)' })
  children?: Pick<BranchDto, 'id' | 'name' | 'code'>[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class BranchListResponseDto {
  @ApiProperty({ type: [BranchDto] })
  data!: BranchDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

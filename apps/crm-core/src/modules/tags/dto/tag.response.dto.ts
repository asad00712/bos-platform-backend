import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TagDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() color!: string | null;
  @ApiProperty() isSystem!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class TagListResponseDto {
  @ApiProperty({ type: [TagDto] }) data!: TagDto[];
  @ApiProperty() total!: number;
}

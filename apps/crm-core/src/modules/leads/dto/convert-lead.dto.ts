import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConvertLeadDto {
  @ApiPropertyOptional({
    description: 'Existing contact ID to link. If omitted, a new contact is auto-created from lead data.',
  })
  @IsOptional()
  @IsUUID()
  contactId?: string;
}

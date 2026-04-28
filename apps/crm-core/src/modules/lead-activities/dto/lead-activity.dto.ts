import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeadActivityDto {
  @ApiProperty() id!: string;
  @ApiProperty() leadId!: string;
  @ApiProperty() type!: string;
  @ApiPropertyOptional() direction?: string | null;
  @ApiPropertyOptional() subject?: string | null;
  @ApiPropertyOptional() body?: string | null;
  @ApiPropertyOptional() outcome?: string | null;
  @ApiPropertyOptional() durationSeconds?: number | null;
  @ApiPropertyOptional() recordingUrl?: string | null;
  @ApiPropertyOptional() transcriptUrl?: string | null;
  @ApiPropertyOptional() scheduledAt?: string | null;
  @ApiPropertyOptional() completedAt?: string | null;
  @ApiPropertyOptional() dueAt?: string | null;
  @ApiPropertyOptional() taskStatus?: string | null;
  @ApiProperty() createdByUserId!: string;
  @ApiPropertyOptional() assignedToUserId?: string | null;
  @ApiPropertyOptional() metadata?: unknown;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class LeadActivitySummaryDto {
  @ApiProperty({ description: 'Count per activity type' })
  counts!: Record<string, number>;

  @ApiProperty() total!: number;
  @ApiPropertyOptional() lastActivityAt?: string | null;
  @ApiPropertyOptional() nextFollowUpAt?: string | null;
  @ApiProperty() touchpointCount!: number;
}

export class LeadActivityListResponseDto {
  @ApiProperty({ type: [LeadActivityDto] }) items!: LeadActivityDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

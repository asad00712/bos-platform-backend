import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskAssigneeDto {
  @ApiProperty() userId!: string;
  @ApiProperty() assignedAt!: string;
  @ApiPropertyOptional() assignedByUserId?: string | null;
}

export class TaskChecklistItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() checklistId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() isChecked!: boolean;
  @ApiPropertyOptional() checkedAt?: string | null;
  @ApiPropertyOptional() checkedByUserId?: string | null;
  @ApiProperty() displayOrder!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class TaskChecklistDto {
  @ApiProperty() id!: string;
  @ApiProperty() taskId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ type: [TaskChecklistItemDto] }) items!: TaskChecklistItemDto[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class TaskDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiProperty() type!: string;
  @ApiProperty() status!: string;
  @ApiProperty() priority!: string;
  @ApiPropertyOptional() startDate?: string | null;
  @ApiPropertyOptional() dueAt?: string | null;
  @ApiPropertyOptional() completedAt?: string | null;
  @ApiPropertyOptional() points?: number | null;
  @ApiPropertyOptional() timeEstimate?: number | null;
  @ApiPropertyOptional() recurrenceRule?: string | null;
  @ApiPropertyOptional() reminders?: string[] | null;
  @ApiPropertyOptional() entityType?: string | null;
  @ApiPropertyOptional() entityId?: string | null;
  @ApiPropertyOptional() parentTaskId?: string | null;
  @ApiPropertyOptional() watchers?: string[] | null;
  @ApiProperty() createdByUserId!: string;
  @ApiPropertyOptional() metadata?: unknown;
  @ApiProperty({ type: [TaskAssigneeDto] }) assignees!: TaskAssigneeDto[];
  @ApiProperty({ type: [TaskChecklistDto] }) checklists!: TaskChecklistDto[];
  /** Only populated on GET /tasks/:id, not in list responses */
  @ApiPropertyOptional({ type: [Object] }) subtasks?: Pick<TaskDto, 'id' | 'title' | 'status' | 'priority' | 'dueAt'>[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class TaskListResponseDto {
  @ApiProperty({ type: [TaskDto] }) items!: TaskDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

import { Injectable } from '@nestjs/common';
import { CustomFieldEntityType, CustomFieldType } from '@bos-prisma/tenant';
import { TenantPrismaService } from '@bos/database';
import type { CreateCustomFieldDto } from '../dto/create-custom-field.dto';
import type { UpdateCustomFieldDto } from '../dto/update-custom-field.dto';
import type { FieldOrderItemDto } from '../dto/reorder-custom-fields.dto';
import type { CustomFieldDefinitionDto } from '../dto/custom-field.response.dto';

@Injectable()
export class CustomFieldRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll(
    schemaName: string,
    entityType?: CustomFieldEntityType,
  ): Promise<CustomFieldDefinitionDto[]> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const records = await prisma.customFieldDefinition.findMany({
      where: {
        isActive: true,
        ...(entityType ? { entityType } : {}),
      },
      orderBy: [{ entityType: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return records.map(this.toDto);
  }

  async findById(
    schemaName: string,
    id: string,
  ): Promise<CustomFieldDefinitionDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.customFieldDefinition.findUnique({ where: { id } });
    return record ? this.toDto(record) : null;
  }

  async findByEntityTypeAndKey(
    schemaName: string,
    entityType: CustomFieldEntityType,
    key: string,
  ): Promise<CustomFieldDefinitionDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.customFieldDefinition.findUnique({
      where: { entityType_key: { entityType, key } },
    });
    return record ? this.toDto(record) : null;
  }

  async create(
    schemaName: string,
    dto: CreateCustomFieldDto,
  ): Promise<CustomFieldDefinitionDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.customFieldDefinition.create({
      data: {
        entityType: dto.entityType,
        label:       dto.label,
        key:         dto.key,
        fieldType:   dto.fieldType as CustomFieldType,
        isRequired:  dto.isRequired ?? false,
        options:     (dto.options ?? []) as object,
        defaultValue: dto.defaultValue,
        placeholder:  dto.placeholder,
        displayOrder: dto.displayOrder ?? 0,
        isActive:     true,
      },
    });
    return this.toDto(record);
  }

  async update(
    schemaName: string,
    id: string,
    dto: UpdateCustomFieldDto,
  ): Promise<CustomFieldDefinitionDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const data: Record<string, unknown> = {};
    if (dto.label !== undefined)       data['label']       = dto.label;
    if (dto.isRequired !== undefined)  data['isRequired']  = dto.isRequired;
    if (dto.options !== undefined)     data['options']     = dto.options;
    if (dto.placeholder !== undefined) data['placeholder'] = dto.placeholder;

    const record = await prisma.customFieldDefinition.update({ where: { id }, data });
    return this.toDto(record);
  }

  async deactivate(schemaName: string, id: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.customFieldDefinition.update({
      where: { id },
      data:  { isActive: false },
    });
  }

  async reorder(schemaName: string, items: FieldOrderItemDto[]): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.$transaction(
      items.map((item) =>
        prisma.customFieldDefinition.update({
          where: { id: item.id },
          data:  { displayOrder: item.displayOrder },
        }),
      ),
    );
  }

  private toDto(record: {
    id: string;
    entityType: CustomFieldEntityType;
    label: string;
    key: string;
    fieldType: CustomFieldType;
    isRequired: boolean;
    options: unknown;
    defaultValue: string | null;
    placeholder: string | null;
    displayOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): CustomFieldDefinitionDto {
    return {
      id:           record.id,
      entityType:   record.entityType,
      label:        record.label,
      key:          record.key,
      fieldType:    record.fieldType,
      isRequired:   record.isRequired,
      options:      (record.options as Array<{ label: string; value: string }>) ?? [],
      defaultValue: record.defaultValue,
      placeholder:  record.placeholder,
      displayOrder: record.displayOrder,
      isActive:     record.isActive,
      createdAt:    record.createdAt,
      updatedAt:    record.updatedAt,
    };
  }
}

import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { CustomFieldEntityType } from '@bos-prisma/tenant';
import { CorePrismaService } from '@bos/database';
import { CustomFieldNotFoundException, CustomFieldKeyConflictException } from '@bos/errors';
import { CustomFieldRepository } from '../repositories/custom-field.repository';
import type { CreateCustomFieldDto } from '../dto/create-custom-field.dto';
import type { UpdateCustomFieldDto } from '../dto/update-custom-field.dto';
import type { ReorderCustomFieldsDto } from '../dto/reorder-custom-fields.dto';
import type {
  CustomFieldDefinitionDto,
  CustomFieldListResponseDto,
} from '../dto/custom-field.response.dto';

const SELECT_TYPES = new Set(['SELECT', 'MULTI_SELECT']);

@Injectable()
export class CustomFieldService {
  constructor(
    private readonly repository: CustomFieldRepository,
    private readonly corePrisma: CorePrismaService,
  ) {}

  async listDefinitions(
    tenantId: string,
    entityType?: string,
  ): Promise<CustomFieldListResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const parsed = entityType ? (entityType as CustomFieldEntityType) : undefined;
    const data = await this.repository.findAll(schemaName, parsed);
    return { data, total: data.length };
  }

  async createDefinition(
    tenantId: string,
    dto: CreateCustomFieldDto,
  ): Promise<CustomFieldDefinitionDto> {
    const schemaName = await this.getSchemaName(tenantId);

    const existing = await this.repository.findByEntityTypeAndKey(
      schemaName, dto.entityType, dto.key,
    );
    if (existing) {
      throw new CustomFieldKeyConflictException(dto.entityType, dto.key);
    }

    if (SELECT_TYPES.has(dto.fieldType) && (!dto.options || dto.options.length === 0)) {
      throw new BadRequestException(
        `fieldType '${dto.fieldType}' requires at least one option`,
      );
    }

    return this.repository.create(schemaName, dto);
  }

  async updateDefinition(
    tenantId: string,
    id: string,
    dto: UpdateCustomFieldDto,
  ): Promise<CustomFieldDefinitionDto> {
    const schemaName = await this.getSchemaName(tenantId);

    const existing = await this.repository.findById(schemaName, id);
    if (!existing) {
      throw new CustomFieldNotFoundException();
    }

    if (
      dto.options !== undefined &&
      SELECT_TYPES.has(existing.fieldType) &&
      dto.options.length === 0
    ) {
      throw new BadRequestException(
        `Cannot remove all options from a '${existing.fieldType}' field`,
      );
    }

    return this.repository.update(schemaName, id, dto);
  }

  async deactivateDefinition(tenantId: string, id: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);

    const existing = await this.repository.findById(schemaName, id);
    if (!existing) {
      throw new CustomFieldNotFoundException();
    }

    await this.repository.deactivate(schemaName, id);
  }

  async reorderDefinitions(
    tenantId: string,
    dto: ReorderCustomFieldsDto,
  ): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);

    for (const item of dto.fields) {
      const field = await this.repository.findById(schemaName, item.id);
      if (!field) {
        throw new UnprocessableEntityException(
          `Custom field '${item.id}' not found — reorder aborted`,
        );
      }
    }

    await this.repository.reorder(schemaName, dto.fields);
  }

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where:  { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }
}

import { Injectable } from '@nestjs/common';
import { CorePrismaService } from '@bos/database';
import { TagNotFoundException, TagNameConflictException } from '@bos/errors';
import { TagRepository } from '../repositories/tag.repository';
import type { CreateTagDto } from '../dto/create-tag.dto';
import type { UpdateTagDto } from '../dto/update-tag.dto';
import type { TagDto, TagListResponseDto } from '../dto/tag.response.dto';

@Injectable()
export class TagService {
  constructor(
    private readonly repository: TagRepository,
    private readonly corePrisma: CorePrismaService,
  ) {}

  async listTags(tenantId: string, search?: string): Promise<TagListResponseDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const data = await this.repository.findAll(schemaName, search);
    return { data, total: data.length };
  }

  async createTag(tenantId: string, dto: CreateTagDto): Promise<TagDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findByName(schemaName, dto.name);
    if (existing) throw new TagNameConflictException(dto.name);
    return this.repository.create(schemaName, dto);
  }

  async updateTag(tenantId: string, id: string, dto: UpdateTagDto): Promise<TagDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new TagNotFoundException();

    if (dto.name !== undefined && dto.name !== existing.name) {
      const nameConflict = await this.repository.findByName(schemaName, dto.name);
      if (nameConflict) throw new TagNameConflictException(dto.name);
    }

    return this.repository.update(schemaName, id, dto);
  }

  async deleteTag(tenantId: string, id: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new TagNotFoundException();
    // Cascade on EntityTag handles cleanup automatically (FK onDelete: Cascade)
    await this.repository.delete(schemaName, id);
  }

  private async getSchemaName(tenantId: string): Promise<string> {
    const tenant = await this.corePrisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { schemaName: true },
    });
    return tenant.schemaName;
  }
}

import { Injectable } from '@nestjs/common';
import { CorePrismaService } from '@bos/database';
import { ContactSourceNotFoundException, ContactSourceNameConflictException } from '@bos/errors';
import { ContactSourceRepository } from '../repositories/contact-source.repository';
import type { CreateContactSourceDto } from '../dto/create-contact-source.dto';
import type { UpdateContactSourceDto } from '../dto/update-contact-source.dto';
import type { ContactSourceDto, ContactSourceListDto } from '../dto/contact.response.dto';

@Injectable()
export class ContactSourceService {
  constructor(
    private readonly repository: ContactSourceRepository,
    private readonly corePrisma: CorePrismaService,
  ) {}

  async listSources(tenantId: string, branchId?: string): Promise<ContactSourceListDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const data = await this.repository.findAll(schemaName, branchId);
    return { data, total: data.length };
  }

  async createSource(tenantId: string, dto: CreateContactSourceDto): Promise<ContactSourceDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findByBranchAndName(schemaName, dto.branchId, dto.name);
    if (existing) throw new ContactSourceNameConflictException(dto.name);
    return this.repository.create(schemaName, dto);
  }

  async updateSource(tenantId: string, id: string, dto: UpdateContactSourceDto): Promise<ContactSourceDto> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new ContactSourceNotFoundException();

    if (dto.name !== undefined && dto.name !== existing.name) {
      const conflict = await this.repository.findByBranchAndName(schemaName, existing.branchId, dto.name);
      if (conflict) throw new ContactSourceNameConflictException(dto.name);
    }

    return this.repository.update(schemaName, id, dto);
  }

  async deleteSource(tenantId: string, id: string): Promise<void> {
    const schemaName = await this.getSchemaName(tenantId);
    const existing = await this.repository.findById(schemaName, id);
    if (!existing) throw new ContactSourceNotFoundException();
    if (existing.isSystem) {
      throw new ContactSourceNotFoundException(); // system sources cannot be deleted
    }
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

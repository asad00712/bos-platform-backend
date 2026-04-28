import { Injectable } from '@nestjs/common';
import { ContactStatus } from '@bos-prisma/tenant';
import { TenantPrismaService } from '@bos/database';
import type { CreateContactDto } from '../dto/create-contact.dto';
import type { UpdateContactDto } from '../dto/update-contact.dto';
import type { ContactFilterDto } from '../dto/contact-filter.dto';
import type { ContactDto } from '../dto/contact.response.dto';

@Injectable()
export class ContactRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findMany(
    schemaName: string,
    filter: ContactFilterDto,
  ): Promise<{ data: ContactDto[]; total: number }> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const page  = filter.page  ?? 1;
    const limit = filter.limit ?? 20;

    const where = this.buildWhere(filter);
    const [records, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return { data: records.map(this.toDto), total };
  }

  async findById(schemaName: string, id: string): Promise<ContactDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.contact.findFirst({
      where: { id, deletedAt: null },
    });
    return record ? this.toDto(record) : null;
  }

  async findByEmail(schemaName: string, email: string): Promise<ContactDto | null> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.contact.findFirst({
      where: { email, deletedAt: null },
    });
    return record ? this.toDto(record) : null;
  }

  async setOriginLeadId(schemaName: string, contactId: string, leadId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.contact.update({ where: { id: contactId }, data: { originLeadId: leadId } });
  }

  async create(
    schemaName: string,
    dto: CreateContactDto,
    createdByUserId?: string,
    originLeadId?: string,
  ): Promise<ContactDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const record = await prisma.contact.create({
      data: {
        branchId:        dto.branchId,
        firstName:       dto.firstName,
        lastName:        dto.lastName ?? null,
        email:           dto.email ?? null,
        phone:           dto.phone ?? null,
        company:         dto.company ?? null,
        jobTitle:        dto.jobTitle ?? null,
        address:         dto.address ?? null,
        city:            dto.city ?? null,
        state:           dto.state ?? null,
        country:         dto.country ?? null,
        postalCode:      dto.postalCode ?? null,
        sourceId:        dto.sourceId ?? null,
        originLeadId:    originLeadId ?? null,
        status:          (dto.status as ContactStatus) ?? ContactStatus.ACTIVE,
        ownedByUserId:   dto.ownedByUserId ?? null,
        notes:           dto.notes ?? null,
        createdByUserId: createdByUserId ?? null,
      },
    });
    return this.toDto(record);
  }

  async update(schemaName: string, id: string, dto: UpdateContactDto): Promise<ContactDto> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined)     data['firstName']     = dto.firstName;
    if (dto.lastName !== undefined)      data['lastName']      = dto.lastName;
    if (dto.email !== undefined)         data['email']         = dto.email;
    if (dto.phone !== undefined)         data['phone']         = dto.phone;
    if (dto.company !== undefined)       data['company']       = dto.company;
    if (dto.jobTitle !== undefined)      data['jobTitle']      = dto.jobTitle;
    if (dto.address !== undefined)       data['address']       = dto.address;
    if (dto.city !== undefined)          data['city']          = dto.city;
    if (dto.state !== undefined)         data['state']         = dto.state;
    if (dto.country !== undefined)       data['country']       = dto.country;
    if (dto.postalCode !== undefined)    data['postalCode']    = dto.postalCode;
    if (dto.sourceId !== undefined)      data['sourceId']      = dto.sourceId;
    if (dto.status !== undefined)        data['status']        = dto.status as ContactStatus;
    if (dto.ownedByUserId !== undefined) data['ownedByUserId'] = dto.ownedByUserId;
    if (dto.notes !== undefined)         data['notes']         = dto.notes;
    const record = await prisma.contact.update({ where: { id }, data });
    return this.toDto(record);
  }

  async softDelete(schemaName: string, id: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.contact.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ── Tag helpers ──────────────────────────────────────────────────────────

  async addTag(schemaName: string, contactId: string, tagId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.entityTag.create({
      data: { tagId, entityType: 'CONTACT', entityId: contactId },
    });
  }

  async removeTag(schemaName: string, contactId: string, tagId: string): Promise<void> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    await prisma.entityTag.deleteMany({
      where: { tagId, entityType: 'CONTACT', entityId: contactId },
    });
  }

  async findTags(schemaName: string, contactId: string): Promise<{ id: string; name: string; color: string | null }[]> {
    const prisma = this.tenantPrisma.forSchema(schemaName);
    const rows = await prisma.entityTag.findMany({
      where: { entityType: 'CONTACT', entityId: contactId },
      include: { tag: { select: { id: true, name: true, color: true } } },
    });
    return rows.map((r) => r.tag);
  }

  private buildWhere(filter: ContactFilterDto) {
    const conditions: Record<string, unknown> = { deletedAt: null };
    if (filter.branchId) conditions['branchId'] = filter.branchId;
    if (filter.status)   conditions['status']   = filter.status as ContactStatus;
    if (filter.sourceId) conditions['sourceId'] = filter.sourceId;
    if (filter.search) {
      const term = filter.search;
      conditions['OR'] = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName:  { contains: term, mode: 'insensitive' } },
        { email:     { contains: term, mode: 'insensitive' } },
        { phone:     { contains: term, mode: 'insensitive' } },
      ];
    }
    return conditions;
  }

  private toDto(record: {
    id: string; branchId: string; firstName: string; lastName: string | null;
    email: string | null; phone: string | null; company: string | null; jobTitle: string | null;
    address: string | null; city: string | null; state: string | null; country: string | null;
    postalCode: string | null; sourceId: string | null; originLeadId: string | null;
    status: ContactStatus; ownedByUserId: string | null; notes: string | null;
    createdAt: Date; updatedAt: Date;
  }): ContactDto {
    return {
      id: record.id, branchId: record.branchId,
      firstName: record.firstName, lastName: record.lastName,
      email: record.email, phone: record.phone, company: record.company,
      jobTitle: record.jobTitle, address: record.address, city: record.city,
      state: record.state, country: record.country, postalCode: record.postalCode,
      sourceId: record.sourceId, originLeadId: record.originLeadId,
      status: record.status, ownedByUserId: record.ownedByUserId,
      notes: record.notes, createdAt: record.createdAt, updatedAt: record.updatedAt,
    };
  }
}

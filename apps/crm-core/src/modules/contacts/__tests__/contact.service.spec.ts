import { ContactService } from '../services/contact.service';
import { ContactNotFoundException, TagNotFoundException } from '@bos/errors';
import type { ContactRepository } from '../repositories/contact.repository';
import type { TagRepository } from '../../tags/repositories/tag.repository';

const TENANT_ID   = 'tenant-uuid-001';
const SCHEMA_NAME = 'tenant_aabbcc1122334455';
const CONTACT_ID  = 'contact-uuid-001';
const TAG_ID      = 'tag-uuid-001';

const mockContact = {
  id: CONTACT_ID, branchId: 'branch-001', firstName: 'John', lastName: 'Doe',
  email: 'john@example.com', phone: null, company: null, jobTitle: null,
  address: null, city: null, state: null, country: null, postalCode: null,
  sourceId: null, originLeadId: null, status: 'ACTIVE', ownedByUserId: null,
  notes: null, createdAt: new Date(), updatedAt: new Date(),
};

const mockRepository: jest.Mocked<ContactRepository> = {
  findMany:   jest.fn(),
  findById:   jest.fn(),
  create:     jest.fn(),
  update:     jest.fn(),
  softDelete: jest.fn(),
  addTag:     jest.fn(),
  removeTag:  jest.fn(),
  findTags:   jest.fn(),
} as unknown as jest.Mocked<ContactRepository>;

const mockTagRepository: jest.Mocked<TagRepository> = {
  findAll:    jest.fn(),
  findById:   jest.fn(),
  findByName: jest.fn(),
  create:     jest.fn(),
  update:     jest.fn(),
  delete:     jest.fn(),
  isTagInUse: jest.fn(),
} as unknown as jest.Mocked<TagRepository>;

const mockCorePrisma = {
  tenant: { findUniqueOrThrow: jest.fn() },
};

describe('ContactService', () => {
  let service: ContactService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockCorePrisma.tenant.findUniqueOrThrow.mockResolvedValue({ schemaName: SCHEMA_NAME });
    service = new ContactService(
      mockRepository,
      mockTagRepository,
      mockCorePrisma as unknown as import('@bos/database').CorePrismaService,
    );
  });

  describe('listContacts', () => {
    it('returns paginated contacts', async () => {
      mockRepository.findMany.mockResolvedValue({ data: [mockContact], total: 1 });
      const result = await service.listContacts(TENANT_ID, { page: 1, limit: 20 });
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('getContact', () => {
    it('returns contact when found', async () => {
      mockRepository.findById.mockResolvedValue(mockContact);
      const result = await service.getContact(TENANT_ID, CONTACT_ID);
      expect(result).toEqual(mockContact);
    });

    it('throws ContactNotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.getContact(TENANT_ID, CONTACT_ID)).rejects.toThrow(ContactNotFoundException);
    });
  });

  describe('createContact', () => {
    it('creates and returns the contact', async () => {
      mockRepository.create.mockResolvedValue(mockContact);
      const result = await service.createContact(
        TENANT_ID,
        { branchId: 'branch-001', firstName: 'John' },
        'user-001',
      );
      expect(result).toEqual(mockContact);
    });
  });

  describe('updateContact', () => {
    it('updates when contact exists', async () => {
      const updated = { ...mockContact, firstName: 'Jane' };
      mockRepository.findById.mockResolvedValue(mockContact);
      mockRepository.update.mockResolvedValue(updated);
      const result = await service.updateContact(TENANT_ID, CONTACT_ID, { firstName: 'Jane' });
      expect(result.firstName).toBe('Jane');
    });

    it('throws ContactNotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.updateContact(TENANT_ID, CONTACT_ID, {})).rejects.toThrow(ContactNotFoundException);
    });
  });

  describe('deleteContact', () => {
    it('soft-deletes when contact exists', async () => {
      mockRepository.findById.mockResolvedValue(mockContact);
      mockRepository.softDelete.mockResolvedValue(undefined);
      await service.deleteContact(TENANT_ID, CONTACT_ID);
      expect(mockRepository.softDelete).toHaveBeenCalledWith(SCHEMA_NAME, CONTACT_ID);
    });

    it('throws ContactNotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.deleteContact(TENANT_ID, CONTACT_ID)).rejects.toThrow(ContactNotFoundException);
    });
  });

  describe('addTag', () => {
    it('adds tag when both contact and tag exist', async () => {
      mockRepository.findById.mockResolvedValue(mockContact);
      mockTagRepository.findById.mockResolvedValue({ id: TAG_ID, name: 'VIP', color: null, isSystem: false, createdAt: new Date(), updatedAt: new Date() });
      mockRepository.addTag.mockResolvedValue(undefined);
      await service.addTag(TENANT_ID, CONTACT_ID, TAG_ID);
      expect(mockRepository.addTag).toHaveBeenCalledWith(SCHEMA_NAME, CONTACT_ID, TAG_ID);
    });

    it('throws ContactNotFoundException when contact not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      mockTagRepository.findById.mockResolvedValue({ id: TAG_ID, name: 'VIP', color: null, isSystem: false, createdAt: new Date(), updatedAt: new Date() });
      await expect(service.addTag(TENANT_ID, CONTACT_ID, TAG_ID)).rejects.toThrow(ContactNotFoundException);
    });

    it('throws TagNotFoundException when tag not found', async () => {
      mockRepository.findById.mockResolvedValue(mockContact);
      mockTagRepository.findById.mockResolvedValue(null);
      await expect(service.addTag(TENANT_ID, CONTACT_ID, TAG_ID)).rejects.toThrow(TagNotFoundException);
    });
  });
});

import { LeadService } from '../services/lead.service';
import {
  LeadNotFoundException,
  LeadAlreadyConvertedException,
  ContactNotFoundException,
  TagNotFoundException,
} from '@bos/errors';
import type { LeadRepository } from '../repositories/lead.repository';
import type { TagRepository } from '../../tags/repositories/tag.repository';
import type { ContactRepository } from '../../contacts/repositories/contact.repository';

const TENANT_ID   = 'tenant-uuid-001';
const SCHEMA_NAME = 'tenant_aabbcc1122334455';
const LEAD_ID     = 'lead-uuid-001';
const TAG_ID      = 'tag-uuid-001';
const CONTACT_ID  = 'contact-uuid-001';
const USER_ID     = 'user-uuid-001';

const mockLead = {
  id: LEAD_ID, branchId: 'branch-001', contactId: null, firstName: 'Jane',
  lastName: 'Smith', email: 'jane@example.com', phone: null, company: null,
  sourceId: null, statusId: null, priority: 'MEDIUM', estimatedValue: null,
  ownedByUserId: null, notes: null, convertedAt: null, convertedByUserId: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const mockContact = {
  id: CONTACT_ID, branchId: 'branch-001', firstName: 'Jane', lastName: 'Smith',
  email: 'jane@example.com', phone: null, company: null, jobTitle: null,
  address: null, city: null, state: null, country: null, postalCode: null,
  sourceId: null, originLeadId: LEAD_ID, status: 'ACTIVE', ownedByUserId: null,
  notes: null, createdAt: new Date(), updatedAt: new Date(),
};

const mockRepository: jest.Mocked<LeadRepository> = {
  findMany:    jest.fn(),
  findById:    jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  convertLead: jest.fn(),
  softDelete:  jest.fn(),
  addTag:      jest.fn(),
  removeTag:   jest.fn(),
  findTags:    jest.fn(),
} as unknown as jest.Mocked<LeadRepository>;

const mockTagRepository: jest.Mocked<TagRepository> = {
  findById: jest.fn(),
} as unknown as jest.Mocked<TagRepository>;

const mockContactRepository: jest.Mocked<ContactRepository> = {
  findById:         jest.fn(),
  findByEmail:      jest.fn(),
  create:           jest.fn(),
  setOriginLeadId:  jest.fn(),
} as unknown as jest.Mocked<ContactRepository>;

const mockCorePrisma = {
  tenant: { findUniqueOrThrow: jest.fn() },
};

const mockWorkflowQueue = { add: jest.fn() };

describe('LeadService', () => {
  let service: LeadService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockCorePrisma.tenant.findUniqueOrThrow.mockResolvedValue({ schemaName: SCHEMA_NAME });
    mockWorkflowQueue.add.mockResolvedValue(undefined);
    mockContactRepository.setOriginLeadId.mockResolvedValue(undefined);
    service = new LeadService(
      mockRepository,
      mockTagRepository,
      mockContactRepository,
      mockCorePrisma as unknown as import('@bos/database').CorePrismaService,
      mockWorkflowQueue as never,
    );
  });

  describe('getLead', () => {
    it('returns lead when found', async () => {
      mockRepository.findById.mockResolvedValue(mockLead);
      expect(await service.getLead(TENANT_ID, LEAD_ID)).toEqual(mockLead);
    });

    it('throws LeadNotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.getLead(TENANT_ID, LEAD_ID)).rejects.toThrow(LeadNotFoundException);
    });
  });

  describe('createLead', () => {
    it('links existing contact when email matches', async () => {
      mockContactRepository.findByEmail.mockResolvedValue(mockContact);
      mockRepository.create.mockResolvedValue({ ...mockLead, contactId: CONTACT_ID });

      const result = await service.createLead(
        TENANT_ID, { branchId: 'branch-001', firstName: 'Jane', email: 'jane@example.com' }, USER_ID,
      );

      expect(mockContactRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalledWith(
        SCHEMA_NAME, expect.any(Object), USER_ID, CONTACT_ID,
      );
      expect(result.contactId).toBe(CONTACT_ID);
    });

    it('creates new contact when email has no match', async () => {
      mockContactRepository.findByEmail.mockResolvedValue(null);
      mockContactRepository.create.mockResolvedValue(mockContact);
      mockRepository.create.mockResolvedValue({ ...mockLead, contactId: CONTACT_ID });

      await service.createLead(
        TENANT_ID, { branchId: 'branch-001', firstName: 'Jane', email: 'jane@example.com' }, USER_ID,
      );

      expect(mockContactRepository.create).toHaveBeenCalled();
      expect(mockContactRepository.setOriginLeadId).toHaveBeenCalledWith(SCHEMA_NAME, CONTACT_ID, LEAD_ID);
      expect(mockWorkflowQueue.add).toHaveBeenCalledWith('crm.lead.created', expect.any(Object));
    });

    it('creates new contact when no email provided', async () => {
      mockContactRepository.create.mockResolvedValue({ ...mockContact, email: null });
      mockRepository.create.mockResolvedValue({ ...mockLead, email: null, contactId: CONTACT_ID });

      await service.createLead(
        TENANT_ID, { branchId: 'branch-001', firstName: 'Jane' }, USER_ID,
      );

      expect(mockContactRepository.findByEmail).not.toHaveBeenCalled();
      expect(mockContactRepository.create).toHaveBeenCalled();
    });
  });

  describe('updateLead', () => {
    it('updates when lead exists', async () => {
      const updated = { ...mockLead, firstName: 'Janet' };
      mockRepository.findById.mockResolvedValue(mockLead);
      mockRepository.update.mockResolvedValue(updated);
      expect(await service.updateLead(TENANT_ID, LEAD_ID, { firstName: 'Janet' }, USER_ID)).toEqual(updated);
    });

    it('emits status change event when statusId changes', async () => {
      const NEW_STATUS = 'status-dropped-uuid';
      mockRepository.findById.mockResolvedValue(mockLead);
      mockRepository.update.mockResolvedValue({ ...mockLead, statusId: NEW_STATUS });

      await service.updateLead(TENANT_ID, LEAD_ID, { statusId: NEW_STATUS }, USER_ID);

      expect(mockWorkflowQueue.add).toHaveBeenCalledWith(
        'crm.lead.status_changed',
        expect.objectContaining({ oldStatusId: null, newStatusId: NEW_STATUS }),
      );
    });

    it('does not emit event when statusId is unchanged', async () => {
      mockRepository.findById.mockResolvedValue({ ...mockLead, statusId: 'same-status' });
      mockRepository.update.mockResolvedValue({ ...mockLead, statusId: 'same-status' });

      await service.updateLead(TENANT_ID, LEAD_ID, { statusId: 'same-status' }, USER_ID);

      expect(mockWorkflowQueue.add).not.toHaveBeenCalled();
    });

    it('throws LeadNotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.updateLead(TENANT_ID, LEAD_ID, {}, USER_ID)).rejects.toThrow(LeadNotFoundException);
    });
  });

  describe('deleteLead', () => {
    it('soft-deletes when lead exists', async () => {
      mockRepository.findById.mockResolvedValue(mockLead);
      mockRepository.softDelete.mockResolvedValue(undefined);
      await service.deleteLead(TENANT_ID, LEAD_ID);
      expect(mockRepository.softDelete).toHaveBeenCalledWith(SCHEMA_NAME, LEAD_ID);
    });

    it('throws LeadNotFoundException when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.deleteLead(TENANT_ID, LEAD_ID)).rejects.toThrow(LeadNotFoundException);
    });
  });

  describe('convertLead', () => {
    it('links to explicit contactId when provided', async () => {
      const converted = { ...mockLead, contactId: CONTACT_ID, convertedAt: new Date() };
      mockRepository.findById.mockResolvedValue(mockLead);
      mockContactRepository.findById.mockResolvedValue(mockContact);
      mockRepository.convertLead.mockResolvedValue(converted);

      const result = await service.convertLead(TENANT_ID, LEAD_ID, { contactId: CONTACT_ID }, USER_ID);

      expect(mockContactRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.convertLead).toHaveBeenCalledWith(SCHEMA_NAME, LEAD_ID, CONTACT_ID, USER_ID);
      expect(result.convertedAt).not.toBeNull();
    });

    it('uses already-linked contact when no contactId provided', async () => {
      const leadWithContact = { ...mockLead, contactId: CONTACT_ID };
      const converted = { ...leadWithContact, convertedAt: new Date() };
      mockRepository.findById.mockResolvedValue(leadWithContact);
      mockRepository.convertLead.mockResolvedValue(converted);

      await service.convertLead(TENANT_ID, LEAD_ID, {}, USER_ID);

      expect(mockContactRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.convertLead).toHaveBeenCalledWith(SCHEMA_NAME, LEAD_ID, CONTACT_ID, USER_ID);
    });

    it('creates contact when no contactId and no existing link', async () => {
      const converted = { ...mockLead, contactId: CONTACT_ID, convertedAt: new Date() };
      mockRepository.findById.mockResolvedValue(mockLead); // contactId: null
      mockContactRepository.create.mockResolvedValue(mockContact);
      mockRepository.convertLead.mockResolvedValue(converted);

      await service.convertLead(TENANT_ID, LEAD_ID, {}, USER_ID);

      expect(mockContactRepository.create).toHaveBeenCalled();
      expect(mockRepository.convertLead).toHaveBeenCalledWith(SCHEMA_NAME, LEAD_ID, CONTACT_ID, USER_ID);
    });

    it('throws LeadNotFoundException when lead not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.convertLead(TENANT_ID, LEAD_ID, {}, USER_ID)).rejects.toThrow(LeadNotFoundException);
    });

    it('throws LeadAlreadyConvertedException when already converted', async () => {
      mockRepository.findById.mockResolvedValue({ ...mockLead, convertedAt: new Date() });
      await expect(service.convertLead(TENANT_ID, LEAD_ID, {}, USER_ID)).rejects.toThrow(
        LeadAlreadyConvertedException,
      );
    });

    it('throws ContactNotFoundException when provided contactId does not exist', async () => {
      mockRepository.findById.mockResolvedValue(mockLead);
      mockContactRepository.findById.mockResolvedValue(null);
      await expect(
        service.convertLead(TENANT_ID, LEAD_ID, { contactId: CONTACT_ID }, USER_ID),
      ).rejects.toThrow(ContactNotFoundException);
    });
  });

  describe('addTag', () => {
    it('adds tag when both lead and tag exist', async () => {
      mockRepository.findById.mockResolvedValue(mockLead);
      mockTagRepository.findById.mockResolvedValue({
        id: TAG_ID, name: 'Hot', color: null, isSystem: false, createdAt: new Date(), updatedAt: new Date(),
      });
      mockRepository.addTag.mockResolvedValue(undefined);
      await service.addTag(TENANT_ID, LEAD_ID, TAG_ID);
      expect(mockRepository.addTag).toHaveBeenCalledWith(SCHEMA_NAME, LEAD_ID, TAG_ID);
    });

    it('throws TagNotFoundException when tag does not exist', async () => {
      mockRepository.findById.mockResolvedValue(mockLead);
      mockTagRepository.findById.mockResolvedValue(null);
      await expect(service.addTag(TENANT_ID, LEAD_ID, TAG_ID)).rejects.toThrow(TagNotFoundException);
    });
  });
});

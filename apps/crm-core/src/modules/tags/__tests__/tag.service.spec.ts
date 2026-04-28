import { TagService } from '../services/tag.service';
import { TagNotFoundException, TagNameConflictException } from '@bos/errors';
import type { TagRepository } from '../repositories/tag.repository';

const TENANT_ID   = 'tenant-uuid-001';
const SCHEMA_NAME = 'tenant_aabbcc1122334455';
const TAG_ID      = 'tag-uuid-001';

const mockTag = {
  id: TAG_ID, name: 'VIP', color: '#FF5733',
  isSystem: false, createdAt: new Date(), updatedAt: new Date(),
};

const mockRepository: jest.Mocked<TagRepository> = {
  findAll:     jest.fn(),
  findById:    jest.fn(),
  findByName:  jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  delete:      jest.fn(),
  isTagInUse:  jest.fn(),
} as unknown as jest.Mocked<TagRepository>;

const mockCorePrisma = {
  tenant: { findUniqueOrThrow: jest.fn() },
};

describe('TagService', () => {
  let service: TagService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockCorePrisma.tenant.findUniqueOrThrow.mockResolvedValue({ schemaName: SCHEMA_NAME });
    service = new TagService(
      mockRepository,
      mockCorePrisma as unknown as import('@bos/database').CorePrismaService,
    );
  });

  describe('listTags', () => {
    it('returns all tags', async () => {
      mockRepository.findAll.mockResolvedValue([mockTag]);
      const result = await service.listTags(TENANT_ID);
      expect(result).toEqual({ data: [mockTag], total: 1 });
    });

    it('passes search filter to repository', async () => {
      mockRepository.findAll.mockResolvedValue([]);
      await service.listTags(TENANT_ID, 'vip');
      expect(mockRepository.findAll).toHaveBeenCalledWith(SCHEMA_NAME, 'vip');
    });
  });

  describe('createTag', () => {
    it('creates tag when name is unique', async () => {
      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockTag);
      const result = await service.createTag(TENANT_ID, { name: 'VIP' });
      expect(result).toEqual(mockTag);
    });

    it('throws TagNameConflictException when name already exists', async () => {
      mockRepository.findByName.mockResolvedValue(mockTag);
      await expect(service.createTag(TENANT_ID, { name: 'VIP' })).rejects.toThrow(
        TagNameConflictException,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateTag', () => {
    it('updates tag when it exists and new name is unique', async () => {
      const updated = { ...mockTag, name: 'Premium' };
      mockRepository.findById.mockResolvedValue(mockTag);
      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.update.mockResolvedValue(updated);
      const result = await service.updateTag(TENANT_ID, TAG_ID, { name: 'Premium' });
      expect(result.name).toBe('Premium');
    });

    it('throws TagNotFoundException when tag does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.updateTag(TENANT_ID, TAG_ID, { name: 'X' })).rejects.toThrow(
        TagNotFoundException,
      );
    });

    it('throws TagNameConflictException when new name already taken', async () => {
      mockRepository.findById.mockResolvedValue(mockTag);
      mockRepository.findByName.mockResolvedValue({ ...mockTag, id: 'other-id', name: 'Premium' });
      await expect(service.updateTag(TENANT_ID, TAG_ID, { name: 'Premium' })).rejects.toThrow(
        TagNameConflictException,
      );
    });

    it('skips name uniqueness check when name is unchanged', async () => {
      mockRepository.findById.mockResolvedValue(mockTag);
      mockRepository.update.mockResolvedValue(mockTag);
      await service.updateTag(TENANT_ID, TAG_ID, { name: 'VIP' });
      expect(mockRepository.findByName).not.toHaveBeenCalled();
    });
  });

  describe('deleteTag', () => {
    it('deletes tag when it exists', async () => {
      mockRepository.findById.mockResolvedValue(mockTag);
      mockRepository.delete.mockResolvedValue(undefined);
      await service.deleteTag(TENANT_ID, TAG_ID);
      expect(mockRepository.delete).toHaveBeenCalledWith(SCHEMA_NAME, TAG_ID);
    });

    it('throws TagNotFoundException when tag does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.deleteTag(TENANT_ID, TAG_ID)).rejects.toThrow(TagNotFoundException);
    });
  });
});

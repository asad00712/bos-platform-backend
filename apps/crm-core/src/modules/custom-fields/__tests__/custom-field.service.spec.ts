import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { CustomFieldEntityType, CustomFieldType } from '@bos-prisma/tenant';
import { CustomFieldNotFoundException, CustomFieldKeyConflictException } from '@bos/errors';
import { CustomFieldService } from '../services/custom-field.service';
import type { CustomFieldRepository } from '../repositories/custom-field.repository';
import type { CreateCustomFieldDto } from '../dto/create-custom-field.dto';
import type { UpdateCustomFieldDto } from '../dto/update-custom-field.dto';
import type { ReorderCustomFieldsDto } from '../dto/reorder-custom-fields.dto';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID   = 'tenant-uuid-001';
const SCHEMA_NAME = 'tenant_aabbcc1122334455';
const FIELD_ID    = 'field-uuid-001';

const mockField = {
  id:           FIELD_ID,
  entityType:   CustomFieldEntityType.CONTACT,
  label:        'Lead Source',
  key:          'lead_source',
  fieldType:    CustomFieldType.SELECT,
  isRequired:   false,
  options:      [{ label: 'Referral', value: 'referral' }, { label: 'Website', value: 'website' }],
  defaultValue: null,
  placeholder:  null,
  displayOrder: 0,
  isActive:     true,
  createdAt:    new Date('2024-01-01'),
  updatedAt:    new Date('2024-01-01'),
};

const mockRepository: jest.Mocked<CustomFieldRepository> = {
  findAll:                jest.fn(),
  findById:               jest.fn(),
  findByEntityTypeAndKey: jest.fn(),
  create:                 jest.fn(),
  update:                 jest.fn(),
  deactivate:             jest.fn(),
  reorder:                jest.fn(),
} as unknown as jest.Mocked<CustomFieldRepository>;

const mockCorePrisma = {
  tenant: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({ schemaName: SCHEMA_NAME }),
  },
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('CustomFieldService', () => {
  let service: CustomFieldService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockCorePrisma.tenant.findUniqueOrThrow.mockResolvedValue({ schemaName: SCHEMA_NAME });
    service = new CustomFieldService(
      mockRepository,
      mockCorePrisma as unknown as import('@bos/database').CorePrismaService,
    );
  });

  // ── listDefinitions ────────────────────────────────────────────────────────

  describe('listDefinitions', () => {
    it('returns definitions filtered by entityType', async () => {
      mockRepository.findAll.mockResolvedValue([mockField]);

      const result = await service.listDefinitions(TENANT_ID, 'CONTACT');

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        SCHEMA_NAME,
        CustomFieldEntityType.CONTACT,
      );
      expect(result).toEqual({ data: [mockField], total: 1 });
    });

    it('returns all definitions when entityType is undefined', async () => {
      mockRepository.findAll.mockResolvedValue([mockField]);

      const result = await service.listDefinitions(TENANT_ID);

      expect(mockRepository.findAll).toHaveBeenCalledWith(SCHEMA_NAME, undefined);
      expect(result.total).toBe(1);
    });
  });

  // ── createDefinition ───────────────────────────────────────────────────────

  describe('createDefinition', () => {
    const createDto: CreateCustomFieldDto = {
      entityType: CustomFieldEntityType.CONTACT,
      label:      'Lead Source',
      key:        'lead_source',
      fieldType:  CustomFieldType.SELECT,
      options:    [{ label: 'Referral', value: 'referral' }],
    };

    it('creates field when key is unique for entityType', async () => {
      mockRepository.findByEntityTypeAndKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockField);

      const result = await service.createDefinition(TENANT_ID, createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(SCHEMA_NAME, createDto);
      expect(result).toEqual(mockField);
    });

    it('throws CustomFieldKeyConflictException when key already exists', async () => {
      mockRepository.findByEntityTypeAndKey.mockResolvedValue(mockField);

      await expect(service.createDefinition(TENANT_ID, createDto)).rejects.toThrow(
        CustomFieldKeyConflictException,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when SELECT field has no options', async () => {
      mockRepository.findByEntityTypeAndKey.mockResolvedValue(null);

      await expect(
        service.createDefinition(TENANT_ID, { ...createDto, options: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when MULTI_SELECT field has no options', async () => {
      mockRepository.findByEntityTypeAndKey.mockResolvedValue(null);

      await expect(
        service.createDefinition(TENANT_ID, {
          ...createDto,
          fieldType: CustomFieldType.MULTI_SELECT,
          options: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows SELECT field when options are provided', async () => {
      mockRepository.findByEntityTypeAndKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockField);

      await expect(service.createDefinition(TENANT_ID, createDto)).resolves.toBeDefined();
    });

    it('does not require options for TEXT field type', async () => {
      mockRepository.findByEntityTypeAndKey.mockResolvedValue(null);
      const textField = { ...mockField, fieldType: CustomFieldType.TEXT };
      mockRepository.create.mockResolvedValue(textField);

      await expect(
        service.createDefinition(TENANT_ID, {
          ...createDto,
          fieldType: CustomFieldType.TEXT,
          options: undefined,
        }),
      ).resolves.toBeDefined();
    });
  });

  // ── updateDefinition ───────────────────────────────────────────────────────

  describe('updateDefinition', () => {
    const updateDto: UpdateCustomFieldDto = { label: 'Acquisition Channel' };

    it('updates label when field exists', async () => {
      const updated = { ...mockField, label: 'Acquisition Channel' };
      mockRepository.findById.mockResolvedValue(mockField);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateDefinition(TENANT_ID, FIELD_ID, updateDto);

      expect(mockRepository.update).toHaveBeenCalledWith(SCHEMA_NAME, FIELD_ID, updateDto);
      expect(result.label).toBe('Acquisition Channel');
    });

    it('throws CustomFieldNotFoundException when field does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateDefinition(TENANT_ID, FIELD_ID, updateDto),
      ).rejects.toThrow(CustomFieldNotFoundException);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when clearing all options from a SELECT field', async () => {
      mockRepository.findById.mockResolvedValue(mockField); // SELECT type

      await expect(
        service.updateDefinition(TENANT_ID, FIELD_ID, { options: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows updating options when at least one remains', async () => {
      const updated = { ...mockField, options: [{ label: 'Referral', value: 'referral' }] };
      mockRepository.findById.mockResolvedValue(mockField);
      mockRepository.update.mockResolvedValue(updated);

      await expect(
        service.updateDefinition(TENANT_ID, FIELD_ID, {
          options: [{ label: 'Referral', value: 'referral' }],
        }),
      ).resolves.toBeDefined();
    });
  });

  // ── deactivateDefinition ───────────────────────────────────────────────────

  describe('deactivateDefinition', () => {
    it('deactivates field when it exists', async () => {
      mockRepository.findById.mockResolvedValue(mockField);
      mockRepository.deactivate.mockResolvedValue(undefined);

      await service.deactivateDefinition(TENANT_ID, FIELD_ID);

      expect(mockRepository.deactivate).toHaveBeenCalledWith(SCHEMA_NAME, FIELD_ID);
    });

    it('throws CustomFieldNotFoundException when field does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.deactivateDefinition(TENANT_ID, FIELD_ID),
      ).rejects.toThrow(CustomFieldNotFoundException);
      expect(mockRepository.deactivate).not.toHaveBeenCalled();
    });
  });

  // ── reorderDefinitions ─────────────────────────────────────────────────────

  describe('reorderDefinitions', () => {
    const reorderDto: ReorderCustomFieldsDto = {
      fields: [
        { id: FIELD_ID, displayOrder: 1 },
        { id: 'field-uuid-002', displayOrder: 2 },
      ],
    };

    it('calls repository.reorder with correct items when all IDs exist', async () => {
      mockRepository.findById
        .mockResolvedValueOnce(mockField)
        .mockResolvedValueOnce({ ...mockField, id: 'field-uuid-002' });
      mockRepository.reorder.mockResolvedValue(undefined);

      await service.reorderDefinitions(TENANT_ID, reorderDto);

      expect(mockRepository.reorder).toHaveBeenCalledWith(SCHEMA_NAME, reorderDto.fields);
    });

    it('throws UnprocessableEntityException when any field ID does not exist', async () => {
      mockRepository.findById
        .mockResolvedValueOnce(mockField)
        .mockResolvedValueOnce(null); // second ID not found

      await expect(
        service.reorderDefinitions(TENANT_ID, reorderDto),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('does not call repository.reorder when a field is not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.reorderDefinitions(TENANT_ID, reorderDto),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockRepository.reorder).not.toHaveBeenCalled();
    });
  });
});

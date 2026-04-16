import type { ConfigService } from '@nestjs/config';
import type { PasswordHasherService } from '@bos/security';
import {
  PasswordTooWeakException,
  TenantSlugTakenException,
  UserAlreadyExistsException,
} from '@bos/errors';
import { VerticalType } from '@bos/common';
import { SignupService } from '../services/signup.service';

describe('SignupService', () => {
  let service: SignupService;

  const users = {
    findByEmail: jest.fn(),
  };

  const hasher: Partial<PasswordHasherService> = {
    hash: jest.fn().mockResolvedValue('$argon2id$hash'),
  };

  const txRunner = jest.fn();

  const prisma = {
    tenant: {
      findUnique: jest.fn(),
    },
    tenantPlan: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => txRunner(fn) as Promise<unknown>),
  };

  const config: Partial<ConfigService> = {
    get: jest.fn().mockReturnValue(86_400),
  };
  const mailQueue = { add: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new SignupService(
      prisma as unknown as ConstructorParameters<typeof SignupService>[0],
      users as unknown as ConstructorParameters<typeof SignupService>[1],
      hasher as PasswordHasherService,
      config as ConfigService,
      mailQueue as unknown as ConstructorParameters<typeof SignupService>[4],
    );

    prisma.tenantPlan.findUnique.mockResolvedValue({ id: 'plan-free-id', slug: 'free' });
    prisma.tenant.findUnique.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);

    txRunner.mockImplementation((fn: (tx: unknown) => unknown) => {
      const txMock = {
        user: { create: jest.fn().mockResolvedValue({ id: 'user-1', email: 'owner@acme.com' }) },
        tenant: {
          create: jest.fn().mockResolvedValue({ id: 'tenant-1', slug: 'acme' }),
        },
        tenantMembership: { create: jest.fn().mockResolvedValue({}) },
        emailVerification: { create: jest.fn().mockResolvedValue({}) },
      };
      return fn(txMock);
    });
  });

  const validDto = (): Parameters<SignupService['execute']>[0] => ({
    email: 'owner@acme.com',
    password: 'SecurePass123',
    firstName: 'Jane',
    lastName: 'Doe',
    orgName: 'Acme Medical',
    orgSlug: 'acme',
    vertical: VerticalType.MEDICAL,
  });

  it('creates user + tenant + membership + email verification in a transaction', async () => {
    const result = await service.execute(validDto());
    expect(result.userId).toBe('user-1');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.tenantSlug).toBe('acme');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(hasher.hash).toHaveBeenCalledWith('SecurePass123');
  });

  it('rejects weak passwords with PasswordTooWeakException', async () => {
    await expect(service.execute({ ...validDto(), password: 'short' })).rejects.toBeInstanceOf(
      PasswordTooWeakException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate email with UserAlreadyExistsException', async () => {
    users.findByEmail.mockResolvedValueOnce({ id: 'existing' });
    await expect(service.execute(validDto())).rejects.toBeInstanceOf(UserAlreadyExistsException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate tenant slug with TenantSlugTakenException', async () => {
    prisma.tenant.findUnique.mockResolvedValueOnce({ id: 'existing-tenant' });
    await expect(service.execute(validDto())).rejects.toBeInstanceOf(TenantSlugTakenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws when seeded `free` plan is missing', async () => {
    prisma.tenantPlan.findUnique.mockResolvedValueOnce(null);
    await expect(service.execute(validDto())).rejects.toThrow(/free.*plan/);
  });
});

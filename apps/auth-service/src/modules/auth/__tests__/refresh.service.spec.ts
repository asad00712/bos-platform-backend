// jose is ESM-only; mock it so ts-jest doesn't choke on the import graph.
jest.mock('jose', () => ({
  SignJWT: jest.fn(),
  importPKCS8: jest.fn(),
  importSPKI: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { RefreshTokenInvalidException, TokenReuseDetectedException } from '@bos/errors';
import { SessionEndReason, SessionScope } from '@bos/common';
import { RefreshService } from '../services/refresh.service';

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 1);

function buildToken(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rt-1',
    tokenHash: 'hash-abc',
    userId: 'user-1',
    sessionId: 'sess-1',
    familyId: 'family-1',
    parentId: null,
    usedAt: null,
    revokedAt: null,
    expiresAt: FUTURE,
    ...overrides,
  };
}

describe('RefreshService', () => {
  const refreshTokens = {
    findByHash: jest.fn(),
    markUsed: jest.fn(),
    revokeFamily: jest.fn(),
    create: jest.fn(),
    revoke: jest.fn(),
  };
  const sessions = {
    findById: jest.fn(),
    end: jest.fn(),
    touch: jest.fn(),
  };
  const tokenIssuer = {
    issueAccessToken: jest.fn().mockResolvedValue({
      token: 'new.access.jwt',
      jti: 'jti-new',
      expiresAt: FUTURE,
    }),
    generateRefreshToken: jest.fn().mockReturnValue({
      raw: 'new-raw-refresh',
      hash: 'new-hash',
      id: 'rt-new',
      expiresAt: FUTURE,
    }),
    accessTtl: 900,
  };

  let service: RefreshService;

  beforeEach(() => {
    service = new RefreshService(
      refreshTokens as unknown as ConstructorParameters<typeof RefreshService>[0],
      sessions as unknown as ConstructorParameters<typeof RefreshService>[1],
      tokenIssuer as unknown as ConstructorParameters<typeof RefreshService>[2],
    );
    sessions.findById.mockResolvedValue({ id: 'sess-1', endedAt: null });
  });

  it('rotates tokens on a valid unused refresh token', async () => {
    refreshTokens.findByHash.mockResolvedValue(buildToken());

    const result = await service.execute('raw-token');

    expect(refreshTokens.markUsed).toHaveBeenCalledWith('rt-1');
    expect(refreshTokens.create).toHaveBeenCalled();
    expect(sessions.touch).toHaveBeenCalledWith('sess-1');
    expect(result.accessToken).toBe('new.access.jwt');
    expect(result.refreshTokenRaw).toBe('new-raw-refresh');
  });

  it('preserves familyId from the parent token in the new refresh token', async () => {
    refreshTokens.findByHash.mockResolvedValue(buildToken({ familyId: 'family-xyz' }));

    await service.execute('raw-token');

    expect(refreshTokens.create).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 'family-xyz', parentId: 'rt-1' }),
    );
  });

  it('throws RefreshTokenInvalidException when token not found', async () => {
    refreshTokens.findByHash.mockResolvedValue(null);
    await expect(service.execute('bad-token')).rejects.toBeInstanceOf(RefreshTokenInvalidException);
    expect(refreshTokens.markUsed).not.toHaveBeenCalled();
  });

  it('throws RefreshTokenInvalidException when token is revoked', async () => {
    refreshTokens.findByHash.mockResolvedValue(buildToken({ revokedAt: PAST }));
    await expect(service.execute('raw-token')).rejects.toBeInstanceOf(RefreshTokenInvalidException);
  });

  it('detects reuse — revokes family + ends session + throws TokenReuseDetectedException', async () => {
    refreshTokens.findByHash.mockResolvedValue(buildToken({ usedAt: PAST }));

    await expect(service.execute('raw-token')).rejects.toBeInstanceOf(TokenReuseDetectedException);
    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('family-1', 'reuse_detected');
    expect(sessions.end).toHaveBeenCalledWith('sess-1', SessionEndReason.TOKEN_REUSE_DETECTED);
    expect(refreshTokens.markUsed).not.toHaveBeenCalled();
  });

  it('throws RefreshTokenInvalidException when token is expired', async () => {
    refreshTokens.findByHash.mockResolvedValue(buildToken({ expiresAt: PAST }));
    await expect(service.execute('raw-token')).rejects.toBeInstanceOf(RefreshTokenInvalidException);
  });

  it('throws RefreshTokenInvalidException when associated session has ended', async () => {
    refreshTokens.findByHash.mockResolvedValue(buildToken());
    sessions.findById.mockResolvedValue({ id: 'sess-1', endedAt: PAST });

    await expect(service.execute('raw-token')).rejects.toBeInstanceOf(RefreshTokenInvalidException);
    expect(refreshTokens.markUsed).toHaveBeenCalled(); // burned before session check
  });

  it('throws RefreshTokenInvalidException when session not found', async () => {
    refreshTokens.findByHash.mockResolvedValue(buildToken());
    sessions.findById.mockResolvedValue(null);

    await expect(service.execute('raw-token')).rejects.toBeInstanceOf(RefreshTokenInvalidException);
  });

  it('issues access token with correct scope and userId', async () => {
    refreshTokens.findByHash.mockResolvedValue(buildToken({ userId: 'user-42', sessionId: 'sess-42' }));
    sessions.findById.mockResolvedValue({ id: 'sess-42', endedAt: null });

    await service.execute('raw-token');

    expect(tokenIssuer.issueAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-42', scope: SessionScope.TENANT, sessionId: 'sess-42' }),
    );
  });
});

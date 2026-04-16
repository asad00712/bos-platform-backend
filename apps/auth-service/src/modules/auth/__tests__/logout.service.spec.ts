// jose is ESM-only; mock it so ts-jest doesn't choke on the import graph.
jest.mock('jose', () => ({
  SignJWT: jest.fn(),
  importPKCS8: jest.fn(),
  importSPKI: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { SessionEndReason } from '@bos/common';
import { LogoutService } from '../services/logout.service';

describe('LogoutService', () => {
  const refreshTokens = {
    findByHash: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
  const sessions = {
    end: jest.fn(),
    endAllForUser: jest.fn(),
  };
  const revocation = {
    revoke: jest.fn(),
  };
  const tokenIssuer = {
    accessTtl: 900,
  };

  let service: LogoutService;

  beforeEach(() => {
    service = new LogoutService(
      refreshTokens as unknown as ConstructorParameters<typeof LogoutService>[0],
      sessions as unknown as ConstructorParameters<typeof LogoutService>[1],
      revocation as unknown as ConstructorParameters<typeof LogoutService>[2],
      tokenIssuer as unknown as ConstructorParameters<typeof LogoutService>[3],
    );
  });

  // ─── logoutCurrent ───────────────────────────────────────────────────────────

  describe('logoutCurrent', () => {
    it('revokes access JTI, refresh token, and ends session', async () => {
      refreshTokens.findByHash.mockResolvedValue({ id: 'rt-1', revokedAt: null });

      await service.logoutCurrent({
        sessionId: 'sess-1',
        accessJti: 'jti-1',
        rawRefreshToken: 'raw-refresh',
      });

      expect(revocation.revoke).toHaveBeenCalledWith('jti-1', 900);
      expect(refreshTokens.revoke).toHaveBeenCalledWith('rt-1', 'logout');
      expect(sessions.end).toHaveBeenCalledWith('sess-1', SessionEndReason.LOGOUT);
    });

    it('skips refresh revocation when rawRefreshToken is null', async () => {
      await service.logoutCurrent({
        sessionId: 'sess-1',
        accessJti: 'jti-1',
        rawRefreshToken: null,
      });

      expect(revocation.revoke).toHaveBeenCalledWith('jti-1', 900);
      expect(refreshTokens.findByHash).not.toHaveBeenCalled();
      expect(refreshTokens.revoke).not.toHaveBeenCalled();
      expect(sessions.end).toHaveBeenCalledWith('sess-1', SessionEndReason.LOGOUT);
    });

    it('skips refresh revocation when token is already revoked', async () => {
      refreshTokens.findByHash.mockResolvedValue({ id: 'rt-1', revokedAt: new Date() });

      await service.logoutCurrent({
        sessionId: 'sess-1',
        accessJti: 'jti-1',
        rawRefreshToken: 'raw-refresh',
      });

      expect(refreshTokens.revoke).not.toHaveBeenCalled();
      expect(sessions.end).toHaveBeenCalled();
    });

    it('skips refresh revocation when token not found in DB', async () => {
      refreshTokens.findByHash.mockResolvedValue(null);

      await service.logoutCurrent({
        sessionId: 'sess-1',
        accessJti: 'jti-1',
        rawRefreshToken: 'raw-refresh',
      });

      expect(refreshTokens.revoke).not.toHaveBeenCalled();
    });
  });

  // ─── logoutAll ────────────────────────────────────────────────────────────────

  describe('logoutAll', () => {
    it('revokes all refresh tokens and ends all sessions for the user', async () => {
      await service.logoutAll('user-1');

      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1', 'logout_all');
      expect(sessions.endAllForUser).toHaveBeenCalledWith('user-1', SessionEndReason.LOGOUT);
    });

    it('does not touch individual JTIs (short TTL makes bulk revocation unnecessary)', async () => {
      await service.logoutAll('user-1');
      expect(revocation.revoke).not.toHaveBeenCalled();
    });
  });
});

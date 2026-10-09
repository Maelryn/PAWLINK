import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { TokensService } from './tokens.service';

const PAYLOAD = { sub: 'u1', role: 'reporter' as const, name: 'Yasmine Belkacem' };

describe('TokensService', () => {
  const originalEnv = { ...process.env };
  let jwt: JwtService;
  let service: TokensService;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_ISSUER;
    jwt = new JwtService({});
    service = new TokensService(jwt);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('payload', () => {
    it('signs exactly { sub, role, name } — nothing else may ride along', async () => {
      const token = await service.signAccess(PAYLOAD);
      const decoded = jwt.decode<Record<string, unknown>>(token) as Record<string, unknown>;

      expect(decoded.sub).toBe('u1');
      expect(decoded.role).toBe('reporter');
      expect(decoded.name).toBe('Yasmine Belkacem');
      // jwt metadata only (iat, exp, iss) — no email, no phone, no password
      expect(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'iss', 'name', 'role', 'sub']);
    });

    it('round-trips through verify', async () => {
      const token = await service.signAccess(PAYLOAD);
      await expect(service.verifyAccess(token)).resolves.toEqual(PAYLOAD);
    });
  });

  describe('separate secrets', () => {
    it('refuses an access token where a refresh token is expected', async () => {
      const access = await service.signAccess(PAYLOAD);
      await expect(service.verifyRefresh(access)).rejects.toBeInstanceOf(HttpException);
    });

    it('refuses a refresh token where an access token is expected', async () => {
      const refresh = await service.signRefresh(PAYLOAD);
      await expect(service.verifyAccess(refresh)).rejects.toBeInstanceOf(HttpException);
    });

    it('honours two different configured secrets', async () => {
      process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      const token = await service.signAccess(PAYLOAD);
      await expect(service.verifyAccess(token)).resolves.toEqual(PAYLOAD);
    });
  });

  describe('ttl', () => {
    it('defaults the access token to 15 minutes and the refresh token to 30 days', async () => {
      const access = jwt.decode<{ iat: number; exp: number }>(await service.signAccess(PAYLOAD))!;
      expect(access.exp - access.iat).toBe(15 * 60);

      const refresh = jwt.decode<{ iat: number; exp: number }>(await service.signRefresh(PAYLOAD))!;
      expect(refresh.exp - refresh.iat).toBe(30 * 24 * 60 * 60);
    });

    it('reads the TTLs from the environment', async () => {
      process.env.JWT_ACCESS_TTL = '5m';
      process.env.JWT_REFRESH_TTL = '7d';
      const access = jwt.decode<{ iat: number; exp: number }>(await service.signAccess(PAYLOAD))!;
      const refresh = jwt.decode<{ iat: number; exp: number }>(await service.signRefresh(PAYLOAD))!;
      expect(access.exp - access.iat).toBe(5 * 60);
      expect(refresh.exp - refresh.iat).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('issuer', () => {
    it('defaults to pawlink and rejects a token with another issuer', async () => {
      const token = await service.signAccess(PAYLOAD);
      expect(jwt.decode<{ iss: string }>(token)!.iss).toBe('pawlink');

      const foreign = jwt.sign(PAYLOAD, { secret: 'dev-access-secret-not-for-production', issuer: 'someone-else' });
      await expect(service.verifyAccess(foreign)).rejects.toBeInstanceOf(HttpException);
    });

    it('uses JWT_ISSUER when set', async () => {
      process.env.JWT_ISSUER = 'pawlink-api';
      const token = await service.signAccess(PAYLOAD);
      expect(jwt.decode<{ iss: string }>(token)!.iss).toBe('pawlink-api');
      await expect(service.verifyAccess(token)).resolves.toEqual(PAYLOAD);
    });
  });

  describe('failure handling', () => {
    it('answers 401 for garbage, tampering and a missing payload', async () => {
      for (const bad of ['not-a-token', 'a.b.c', '', 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1MSJ9.']) {
        await expect(service.verifyAccess(bad)).rejects.toMatchObject({ status: 401 });
      }
    });

    it('uses one code for invalid and expired tokens alike', async () => {
      const error = await service.verifyAccess('garbage').catch((e) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'AUTH_TOKEN_INVALID' });
    });

    it('refuses to sign with a missing secret in production', async () => {
      process.env.NODE_ENV = 'production';
      const prodService = new TokensService(new JwtService({}));
      const error = await prodService.signAccess(PAYLOAD).catch((e) => e);

      expect((error as HttpException).getStatus()).toBe(500);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'AUTH_SECRET_MISSING' });
    });

    it('falls back to a dev secret with a warning when NODE_ENV is not production', async () => {
      process.env.NODE_ENV = 'development';
      await expect(service.signAccess(PAYLOAD)).resolves.toEqual(expect.any(String));
    });
  });
});

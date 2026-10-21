import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

/**
 * Phase 0 acceptance: the app boots, /health answers honestly (DB may be down —
 * a placeholder .env is fine), /docs serves the OpenAPI spec, and unknown routes
 * come back in the §3.1 error envelope.
 */
describe('PawLink API (phase 0)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('answers with status + db state + no secrets', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toMatchObject({
        status: expect.stringMatching(/^(ok|degraded)$/),
        db: expect.stringMatching(/^(up|down)$/),
        version: '0.1.0',
      });
      expect(typeof res.body.uptimeSec).toBe('number');
      expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
      // never leak configuration
      expect(JSON.stringify(res.body)).not.toMatch(/postgres:|JWT|secret/i);
    });
  });

  describe('Swagger', () => {
    it('serves an OpenAPI 3 document at /docs-json', async () => {
      const res = await request(app.getHttpServer()).get('/docs-json').expect(200);
      expect(res.body.openapi).toMatch(/^3\./);
      expect(res.body.info.title).toBe('PawLink API');
      expect(res.body.paths['/health']).toBeDefined();
    });

    it('serves the Swagger UI at /docs', async () => {
      const res = await request(app.getHttpServer()).get('/docs').expect(200);
      expect(res.text).toContain('swagger-ui');
    });
  });

  describe('error envelope', () => {
    it('unknown routes answer { statusCode, message, code }', async () => {
      const res = await request(app.getHttpServer()).get('/definitely-not-a-route').expect(404);
      expect(res.body).toEqual({ statusCode: 404, message: expect.any(String), code: 'NOT_FOUND' });
    });
  });
});

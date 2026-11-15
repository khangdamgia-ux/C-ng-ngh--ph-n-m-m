import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { finalize, requestId, requireInternalKey } from './http.js';
import type { Logger } from './logger.js';

const silent: Logger = { info: () => {}, warn: () => {}, error: () => {} };

/** App nhỏ để thử từng middleware, kết thúc bằng finalize như các service thật. */
function appWith(...mw: express.RequestHandler[]) {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.get('/t', ...mw, (req, res) => res.json({ ok: true, user: req.user ?? null, requestId: req.requestId }));
  return finalize(app, silent);
}

describe('requestId', () => {
  it('tự sinh X-Request-Id khi client không gửi', async () => {
    const res = await request(appWith()).get('/t');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('chuyển tiếp X-Request-Id do client gửi', async () => {
    const res = await request(appWith()).get('/t').set('X-Request-Id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('bỏ X-Request-Id quá dài (> 64 ký tự) và sinh mã mới', async () => {
    const res = await request(appWith()).get('/t').set('X-Request-Id', 'x'.repeat(65));
    expect(res.headers['x-request-id']).not.toBe('x'.repeat(65));
  });
});

describe('requireInternalKey', () => {
  const saved = process.env.INTERNAL_API_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = saved;
  });

  it('cho qua khi X-Internal-Key đúng', async () => {
    process.env.INTERNAL_API_KEY = 'khoa-noi-bo';
    const res = await request(appWith(requireInternalKey)).get('/t').set('X-Internal-Key', 'khoa-noi-bo');
    expect(res.status).toBe(200);
  });

  it.each([
    ['thiếu header', undefined],
    ['sai khóa', 'khoa-sai'],
    ['khác độ dài', 'k'],
  ])('trả 401 khi %s', async (_case, key) => {
    process.env.INTERNAL_API_KEY = 'khoa-noi-bo';
    const req = request(appWith(requireInternalKey)).get('/t');
    const res = await (key ? req.set('X-Internal-Key', key) : req);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('từ chối mọi yêu cầu khi server chưa cấu hình INTERNAL_API_KEY', async () => {
    delete process.env.INTERNAL_API_KEY;
    const res = await request(appWith(requireInternalKey)).get('/t').set('X-Internal-Key', '');
    expect(res.status).toBe(401);
  });
});

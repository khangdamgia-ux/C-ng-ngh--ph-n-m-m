import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { finalize, requestId } from './http.js';
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

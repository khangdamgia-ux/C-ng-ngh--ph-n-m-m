import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { badRequest } from './errors.js';
import { asyncHandler, createBaseApp, finalize, parse, requestId, requireInternalKey, requireRole } from './http.js';
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

describe('requireRole', () => {
  it('gắn req.user khi vai trò hợp lệ', async () => {
    const res = await request(appWith(requireRole('SUPER_ADMIN', 'EDITOR')))
      .get('/t')
      .set('X-User-Id', '7')
      .set('X-User-Role', 'EDITOR');
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 7, role: 'EDITOR' });
  });

  it('trả 401 khi thiếu danh tính', async () => {
    const res = await request(appWith(requireRole('SUPER_ADMIN'))).get('/t');
    expect(res.status).toBe(401);
  });

  it('trả 401 khi X-User-Id không phải số', async () => {
    const res = await request(appWith(requireRole())).get('/t').set('X-User-Id', 'abc').set('X-User-Role', 'EDITOR');
    expect(res.status).toBe(401);
  });

  it('trả 403 khi EDITOR gọi API chỉ dành cho SUPER_ADMIN', async () => {
    const res = await request(appWith(requireRole('SUPER_ADMIN')))
      .get('/t')
      .set('X-User-Id', '7')
      .set('X-User-Role', 'EDITOR');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('không giới hạn vai trò khi không truyền vai trò nào', async () => {
    const res = await request(appWith(requireRole())).get('/t').set('X-User-Id', '1').set('X-User-Role', 'EDITOR');
    expect(res.status).toBe(200);
  });
});

describe('errorHandler và finalize', () => {
  const errors: string[] = [];
  const spyLogger: Logger = { ...silent, error: (msg) => void errors.push(msg) };

  function failing(handler: express.RequestHandler) {
    const app = express();
    app.use(requestId);
    app.use(express.json());
    app.post('/t', handler);
    return finalize(app, spyLogger);
  }

  it('route không tồn tại → 404 NOT_FOUND kèm requestId', async () => {
    const res = await request(appWith()).get('/khong-co');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('ZodError → 400 kèm danh sách trường sai', async () => {
    const schema = z.object({ code: z.string().min(1), lat: z.number() });
    const res = await request(failing((req, res) => void res.json(parse(schema, req.body)))).post('/t').send({ code: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['code', 'lat']);
  });

  it('AppError → đúng mã HTTP và mã lỗi', async () => {
    const res = await request(
      failing(() => {
        throw badRequest('Sai dữ liệu', [{ field: 'x', issue: 'bắt buộc' }]);
      }),
    ).post('/t');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Sai dữ liệu', details: [{ field: 'x' }] });
  });

  it('JSON hỏng → 400 "JSON không hợp lệ"', async () => {
    const res = await request(failing((_req, res) => void res.json({})))
      .post('/t')
      .set('Content-Type', 'application/json')
      .send('{hong');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('JSON không hợp lệ');
  });

  it('lỗi bất ngờ trong asyncHandler → 500, ghi log, không lộ chi tiết lỗi', async () => {
    errors.length = 0;
    const res = await request(
      failing(
        asyncHandler(async () => {
          throw new Error('mat ket noi DB: password=bi-mat');
        }),
      ),
    ).post('/t');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('bi-mat');
    expect(errors).toHaveLength(1);
  });
});

describe('createBaseApp', () => {
  const app = finalize(createBaseApp('test-service', { db: false }), silent);

  it('/health trả trạng thái ok và tên service', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'test-service' });
  });

  it('/ready trả ready khi service không cần DB', async () => {
    const res = await request(app).get('/ready');
    expect(res.body).toEqual({ status: 'ready', service: 'test-service' });
  });

  it('không lộ header X-Powered-By', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

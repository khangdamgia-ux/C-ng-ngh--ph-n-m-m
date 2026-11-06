/**
 * Kiểm thử tích hợp (PRD Phần XIII) – chạy 2 service + API Gateway trong cùng tiến trình, với SQL Server thật.
 * Yêu cầu: đã chạy `npm run db:seed`; biến môi trường DB_* trỏ tới SQL Server.
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

process.env.LOG_SILENT = '1';
process.env.INTERNAL_API_KEY ??= 'test-internal-key';
process.env.RATE_LIMIT_PER_MIN = '100000';

const DEAD = 'http://127.0.0.1:9'; // cổng không có dịch vụ

const servers: Server[] = [];
let gw: Express;
const urls: Record<string, string> = {};

async function listen(app: Express) {
  const s = app.listen(0);
  await new Promise((r) => s.once('listening', r));
  servers.push(s);
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  const [location, content, gateway] = await Promise.all([
    import('../../services/location/src/app.js'),
    import('../../services/content/src/app.js'),
    import('../../services/gateway/src/app.js'),
  ]);
  urls.location = await listen(location.createApp());
  urls.content = await listen(content.createApp());
  Object.assign(process.env, {
    LOCATION_SERVICE_URL: urls.location, CONTENT_SERVICE_URL: urls.content,
  });
  gw = gateway.createApp();
});

afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  const { closePool } = await import('@hoian/shared');
  await closePool();
});

describe('API công khai', () => {
  it('TC01 · danh sách 15 di tích công khai, có tiêu đề tiếng Việt', async () => {
    const res = await request(gw).get('/api/v1/locations?pageSize=100');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(15);
    const chuaCau = res.body.items.find((i: { code: string }) => i.code === 'chua-cau');
    expect(chuaCau.title).toBe('Chùa Cầu – Lai Viễn Kiều');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('chi tiết + thuyết minh tiếng Việt', async () => {
    const res = await request(gw).get('/api/v1/locations/chua-cau/narration');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ language: 'vi', locationCode: 'chua-cau' });
    expect(res.body.content.length).toBeGreaterThan(500);
  });

  it('TC02 · mã địa điểm không tồn tại → 404', async () => {
    const res = await request(gw).get('/api/v1/locations/khong-ton-tai');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('dữ liệu đầu vào sai → 400 có chi tiết', async () => {
    const res = await request(gw).get('/api/v1/locations?pageSize=1000');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('pageSize');
  });
});

describe('Bảo mật', () => {
  it('không còn API quản trị → 404', async () => {
    expect((await request(gw).get('/api/v1/admin/locations')).status).toBe(404);
  });

  it('không lộ API /internal qua Gateway; gọi thẳng service thiếu khóa → 401', async () => {
    expect((await request(gw).get('/api/v1/internal/locations/chua-cau/status')).status).toBe(404);
    expect((await fetch(`${urls.location}/internal/locations/chua-cau/status`)).status).toBe(401);
  });
});

describe('TC25 · Giao tiếp giữa các service khi có service lỗi (FR-20, NFR-10)', () => {
  it('Content Service lỗi → Gateway trả 503 UPSTREAM_UNAVAILABLE có requestId', async () => {
    const { createApp } = await import('../../services/gateway/src/app.js');
    process.env.CONTENT_SERVICE_URL = DEAD;
    const broken = createApp();
    process.env.CONTENT_SERVICE_URL = urls.content;
    const res = await request(broken).get('/api/v1/locations/chua-cau/narration');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('Location gọi Content thất bại → danh sách vẫn trả về (suy giảm có kiểm soát)', async () => {
    process.env.CONTENT_SERVICE_URL = DEAD;
    try {
      const res = await request(gw).get('/api/v1/locations?pageSize=5');
      expect(res.status).toBe(200);
      expect(res.body.contentDegraded).toBe(true);
      expect(res.body.items[0].title).toBe(res.body.items[0].name);
    } finally {
      process.env.CONTENT_SERVICE_URL = urls.content;
    }
  });

  it('Content gọi Location thất bại (timeout + retry) → 503', async () => {
    process.env.LOCATION_SERVICE_URL = DEAD;
    try {
      const res = await request(gw).get('/api/v1/locations/chua-cau/narration');
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    } finally {
      process.env.LOCATION_SERVICE_URL = urls.location;
    }
  });

  it('/ready của Gateway kiểm tra cả 2 service', async () => {
    const res = await request(gw).get('/ready');
    expect(res.body.services).toEqual({ location: 'up', content: 'up' });
  });
});

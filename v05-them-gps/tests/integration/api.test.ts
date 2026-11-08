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
  it('TC01 · danh sách 15 di tích công khai, có tiêu đề theo ngôn ngữ', async () => {
    const res = await request(gw).get('/api/v1/locations?lang=ja&pageSize=100');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(15);
    const chuaCau = res.body.items.find((i: { code: string }) => i.code === 'chua-cau');
    expect(chuaCau.title).toBe('日本橋（来遠橋）');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('TC05 · tìm kiếm không dấu "chua cau" ra Chùa Cầu', async () => {
    const res = await request(gw).get('/api/v1/locations?q=chua%20cau&lang=vi');
    expect(res.body.items.map((i: { code: string }) => i.code)).toContain('chua-cau');
  });

  it('TC05b · tìm theo tiêu đề bản dịch ("Assembly Hall")', async () => {
    const res = await request(gw).get('/api/v1/locations?q=Assembly%20Hall&lang=en');
    expect(res.body.items.length).toBeGreaterThanOrEqual(4);
  });

  it('TC06 · từ khóa không tồn tại → danh sách rỗng', async () => {
    const res = await request(gw).get('/api/v1/locations?q=xyzxyz');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('TC07 · lọc theo loại Hội quán', async () => {
    const res = await request(gw).get('/api/v1/locations?category=HOI_QUAN');
    expect(res.body.items.length).toBe(4);
    expect(res.body.items.every((i: { category: { code: string } }) => i.category.code === 'HOI_QUAN')).toBe(true);
  });

  it('chi tiết + thuyết minh tiếng Hàn', async () => {
    const res = await request(gw).get('/api/v1/locations/chua-cau/narration?lang=ko');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ language: 'ko', isFallback: false, locationCode: 'chua-cau' });
    expect(res.body.content.length).toBeGreaterThan(500);
  });

  it('địa điểm gần (nearby)', async () => {
    const res = await request(gw).get('/api/v1/locations/nearby?lat=15.87709&lng=108.32602&radius=60');
    expect(res.body.items[0].code).toBe('chua-cau');
  });

  it('TC29 · ngôn ngữ chưa có → dự phòng theo thứ tự (EN)', async () => {
    const n = await request(gw).get('/api/v1/locations/chua-cau/narration?lang=de');
    expect(n.status).toBe(200);
    expect(n.body).toMatchObject({ language: 'en', requestedLanguage: 'de', isFallback: true });
  });

  it('TC02 · mã địa điểm không tồn tại → 404', async () => {
    const res = await request(gw).get('/api/v1/locations/khong-ton-tai');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('dữ liệu đầu vào sai → 400 có chi tiết', async () => {
    const res = await request(gw).get('/api/v1/locations/nearby?lat=95&lng=1');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('lat');
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
    const res = await request(broken).get('/api/v1/locations/chua-cau/narration?lang=vi');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('Location gọi Content thất bại → danh sách vẫn trả về (suy giảm có kiểm soát)', async () => {
    process.env.CONTENT_SERVICE_URL = DEAD;
    try {
      const res = await request(gw).get('/api/v1/locations?lang=en&pageSize=5');
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
      const res = await request(gw).get('/api/v1/locations/chua-cau/narration?lang=vi');
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

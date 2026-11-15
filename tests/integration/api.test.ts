/**
 * Kiểm thử tích hợp (PRD Phần XIII) – chạy 4 service + API Gateway trong cùng tiến trình, với SQL Server thật.
 * Yêu cầu: đã chạy `npm run db:seed`; biến môi trường DB_* trỏ tới SQL Server.
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

process.env.LOG_SILENT = '1';
process.env.INTERNAL_API_KEY ??= 'test-internal-key';
process.env.JWT_SECRET ??= 'test-jwt-secret-0123456789abcdef0123';
process.env.RATE_LIMIT_PER_MIN = '100000';
process.env.MEDIA_DIR ??= './media-test';

const ADMIN_USER = process.env.SEED_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASS = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
const DEAD = 'http://127.0.0.1:9'; // cổng không có dịch vụ
const suffix = Date.now().toString(36);

const servers: Server[] = [];
let gw: Express;
let token = '';
const urls: Record<string, string> = {};

async function listen(app: Express) {
  const s = app.listen(0);
  await new Promise((r) => s.once('listening', r));
  servers.push(s);
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  const [auth, location, content, analytics, gateway] = await Promise.all([
    import('../../services/auth/src/app.js'),
    import('../../services/location/src/app.js'),
    import('../../services/content/src/app.js'),
    import('../../services/analytics/src/app.js'),
    import('../../services/gateway/src/app.js'),
  ]);
  urls.auth = await listen(auth.createApp());
  urls.location = await listen(location.createApp());
  urls.content = await listen(content.createApp());
  urls.analytics = await listen(analytics.createApp());
  Object.assign(process.env, {
    AUTH_SERVICE_URL: urls.auth, LOCATION_SERVICE_URL: urls.location, CONTENT_SERVICE_URL: urls.content, ANALYTICS_SERVICE_URL: urls.analytics,
  });
  gw = gateway.createApp();
  const res = await request(gw).post('/api/v1/auth/login').send({ username: ADMIN_USER, password: ADMIN_PASS });
  expect(res.status).toBe(200);
  token = res.body.token;
});

afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  const { closePool } = await import('@hoian/shared');
  await closePool();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

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

describe('Bảo mật & phân quyền', () => {
  it('TC17 · API quản trị không có token → 401', async () => {
    expect((await request(gw).get('/api/v1/admin/locations')).status).toBe(401);
  });

  it('chặn giả mạo header nội bộ từ client', async () => {
    const res = await request(gw).get('/api/v1/admin/accounts').set('X-User-Id', '1').set('X-User-Role', 'SUPER_ADMIN').set('X-Internal-Key', 'x');
    expect(res.status).toBe(401);
  });

  it('không lộ API /internal qua Gateway; gọi thẳng service thiếu khóa → 401', async () => {
    expect((await request(gw).get('/api/v1/internal/locations/chua-cau/status')).status).toBe(404);
    expect((await fetch(`${urls.location}/internal/locations/chua-cau/status`)).status).toBe(401);
  });

  it('TC16 · sai mật khẩu → 401 với thông báo chung', async () => {
    const res = await request(gw).post('/api/v1/auth/login').send({ username: ADMIN_USER, password: 'sai-mat-khau' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Thông tin đăng nhập không đúng');
  });

  it('TC35 · sai 5 lần → khóa tạm (429)', async () => {
    const u = `nobody-${suffix}`;
    for (let i = 0; i < 5; i++) await request(gw).post('/api/v1/auth/login').send({ username: u, password: 'x' });
    expect((await request(gw).post('/api/v1/auth/login').send({ username: u, password: 'x' })).status).toBe(429);
  });

  it('TC18 · EDITOR không được quản lý tài khoản (403) nhưng được quản lý địa điểm', async () => {
    const username = `editor-${suffix}`;
    const created = await request(gw).post('/api/v1/admin/accounts').set(auth()).send({ username, password: 'Editor@123', role: 'EDITOR' });
    expect(created.status).toBe(201);
    const login = await request(gw).post('/api/v1/auth/login').send({ username, password: 'Editor@123' });
    const editor = { Authorization: `Bearer ${login.body.token}` };
    expect((await request(gw).get('/api/v1/admin/accounts').set(editor)).status).toBe(403);
    expect((await request(gw).get('/api/v1/admin/locations').set(editor)).status).toBe(200);
    expect((await request(gw).get('/api/v1/auth/me').set(editor)).body.role).toBe('EDITOR');
  });

  it('TC40 · mật khẩu lưu dạng bcrypt', async () => {
    const { query } = await import('@hoian/shared');
    const rows = await query<{ password_hash: string }>('SELECT password_hash FROM dbo.Admins');
    expect(rows.every((r) => /^\$2[aby]\$12\$/.test(r.password_hash))).toBe(true);
  });
});

describe('Quản trị địa điểm & nội dung', () => {
  const code = `test-${suffix}`;
  let id = 0;

  it('TC20 · thiếu tên → 400 VALIDATION_ERROR', async () => {
    const res = await request(gw).post('/api/v1/admin/locations').set(auth()).send({ code, categoryId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('name');
  });

  it('TC38 · vĩ độ 95 → 400', async () => {
    const res = await request(gw).post('/api/v1/admin/locations').set(auth()).send({ code, name: 'X', categoryId: 1, latitude: 95, longitude: 108 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('latitude');
  });

  it('TC19 · tạo địa điểm hợp lệ → 201; trùng code → 409', async () => {
    const body = { code, name: 'Nhà kiểm thử', categoryId: 3, latitude: 15.8771, longitude: 108.3271, triggerRadiusM: 20, isPublished: false };
    const res = await request(gw).post('/api/v1/admin/locations').set(auth()).send(body);
    expect(res.status).toBe(201);
    id = res.body.id;
    expect((await request(gw).post('/api/v1/admin/locations').set(auth()).send(body)).status).toBe(409);
  });

  it('TC32 · địa điểm chưa công khai không xuất hiện ở API công khai', async () => {
    const list = await request(gw).get('/api/v1/locations?pageSize=100');
    expect(list.body.items.some((i: { code: string }) => i.code === code)).toBe(false);
    expect((await request(gw).get(`/api/v1/locations/${code}`)).status).toBe(404);
  });

  it('TC21 + TC29 · thêm bản dịch VI; yêu cầu KO → dự phòng (không có EN nên dùng VI)', async () => {
    const put = await request(gw).put(`/api/v1/admin/locations/${id}/narrations/vi`).set(auth())
      .send({ title: 'Nhà kiểm thử', summary: 'Tóm tắt', content: 'Nội dung thuyết minh kiểm thử.', status: 'PUBLISHED' });
    expect(put.status).toBe(200);
    // Upsert lần 2 không tạo bản ghi trùng (UNIQUE location_id, language_id)
    await request(gw).put(`/api/v1/admin/locations/${id}/narrations/vi`).set(auth()).send({ title: 'Nhà kiểm thử 2', content: 'Nội dung 2', status: 'PUBLISHED' });
    const list = await request(gw).get(`/api/v1/admin/locations/${id}/narrations`).set(auth());
    expect(list.body.items).toHaveLength(1);
    await request(gw).patch(`/api/v1/admin/locations/${id}/publish`).set(auth()).send({ isPublished: true });
    const n = await request(gw).get(`/api/v1/locations/${code}/narration?lang=ko`);
    expect(n.body).toMatchObject({ language: 'vi', requestedLanguage: 'ko', isFallback: true, title: 'Nhà kiểm thử 2' });
  });

  it('cập nhật tọa độ & bán kính; bán kính 0 bị từ chối', async () => {
    expect((await request(gw).put(`/api/v1/admin/locations/${id}/geo`).set(auth()).send({ latitude: 15.8772, longitude: 108.3272, triggerRadiusM: 0 })).status).toBe(400);
    const ok = await request(gw).put(`/api/v1/admin/locations/${id}/geo`).set(auth()).send({ latitude: 15.8772, longitude: 108.3272, triggerRadiusM: 30 });
    expect(ok.body.triggerRadiusM).toBe(30);
  });

  it('FR-17 · tải mã QR PNG', async () => {
    const res = await request(gw).get(`/api/v1/admin/locations/${id}/qr?format=png`).set(auth()).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  it('TC41 · tải lên file sai định dạng → 400; MP3 hợp lệ → phát được qua /media (hỗ trợ Range)', async () => {
    const list = await request(gw).get(`/api/v1/admin/locations/${id}/narrations`).set(auth());
    const nid = list.body.items[0].id;
    const bad = await request(gw).post(`/api/v1/admin/narrations/${nid}/audio`).set(auth()).attach('audio', Buffer.from('RIFF....'), { filename: 'a.wav', contentType: 'audio/wav' });
    expect(bad.status).toBe(400);
    const good = await request(gw).post(`/api/v1/admin/narrations/${nid}/audio`).set(auth())
      .field('durationSeconds', '12').attach('audio', Buffer.alloc(2048, 1), { filename: 'test.mp3', contentType: 'audio/mpeg' });
    expect(good.status).toBe(200);
    const media = await request(gw).get(good.body.audioUrl).set('Range', 'bytes=0-99');
    expect(media.status).toBe(206);
  });

  it('xóa mềm: biến mất khỏi admin, vẫn còn trong CSDL', async () => {
    expect((await request(gw).delete(`/api/v1/admin/locations/${id}`).set(auth())).status).toBe(204);
    const list = await request(gw).get('/api/v1/admin/locations').set(auth());
    expect(list.body.items.some((i: { id: number }) => i.id === id)).toBe(false);
    const { query } = await import('@hoian/shared');
    const [row] = await query<{ deleted_at: Date | null }>('SELECT deleted_at FROM dbo.Locations WHERE id = @id', { id });
    expect(row.deleted_at).not.toBeNull();
  });
});

describe('Thống kê', () => {
  const sid = `test-session-${suffix}`;
  const simSid = `test-sim-${suffix}`;

  it('TC23 · tạo phiên + heartbeat → được đếm là đang hoạt động; phiên mô phỏng không được đếm', async () => {
    const before = (await request(gw).get('/api/v1/admin/stats/active-sessions').set(auth())).body.activeSessions;
    expect((await request(gw).post('/api/v1/analytics/sessions').send({ sessionId: sid, languageCode: 'ko', source: 'QR' })).status).toBe(201);
    expect((await request(gw).post(`/api/v1/analytics/sessions/${sid}/heartbeat`)).status).toBe(204);
    await request(gw).post('/api/v1/analytics/sessions').send({ sessionId: simSid, isSimulated: true });
    const after = (await request(gw).get('/api/v1/admin/stats/active-sessions').set(auth())).body.activeSessions;
    expect(after).toBe(before + 1);
  });

  it('ghi sự kiện; loại sự kiện lạ → 400', async () => {
    expect((await request(gw).post('/api/v1/analytics/events').send({ sessionId: sid, eventType: 'AUDIO_PLAY', locationId: 1 })).status).toBe(202);
    expect((await request(gw).post('/api/v1/analytics/events').send({ sessionId: sid, eventType: 'HACK' })).status).toBe(400);
  });

  it('TC24 · thống kê theo tuần và top địa điểm', async () => {
    const v = await request(gw).get('/api/v1/admin/stats/visits?groupBy=week').set(auth());
    expect(v.status).toBe(200);
    expect(v.body.items.length).toBeGreaterThan(0);
    const top = await request(gw).get('/api/v1/admin/stats/top-locations').set(auth());
    expect(top.body.items.find((i: { locationId: number }) => i.locationId === 1)?.name).toBe('Chùa Cầu (Lai Viễn Kiều)');
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

  it('/ready của Gateway kiểm tra cả 4 service', async () => {
    const res = await request(gw).get('/ready');
    expect(res.body.services).toEqual({ auth: 'up', location: 'up', content: 'up', analytics: 'up' });
  });
});

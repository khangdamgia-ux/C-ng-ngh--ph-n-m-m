import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Giả lập CSDL: ghi lại mọi câu SQL, trả kết quả theo nội dung câu lệnh.
const calls: Array<{ sql: string; params: Record<string, unknown> }> = [];
let deletedRow = true;
vi.mock('@hoian/shared', async (orig) => {
  const actual = await orig<typeof import('@hoian/shared')>();
  return {
    ...actual,
    query: vi.fn(async (sql: string, params: Record<string, unknown> = {}) => {
      calls.push({ sql, params });
      if (sql.includes('SET deleted_at = NULL')) return deletedRow ? [{ id: params.id }] : [];
      if (sql.includes('SELECT l.*')) {
        return [{ id: 14, code: 'bao-tang-hoi-an', name: 'Bảo tàng Hội An', description: null, address: null, latitude: 15.8796, longitude: 108.3306,
          category_id: 4, category_code: 'BAO_TANG', category_name: 'Bảo tàng', trigger_radius_m: 25, priority: 0, opening_hours: null,
          ticket_price: null, image_url: null, is_published: false, updated_at: new Date() }];
      }
      return [];
    }),
  };
});

const { createApp } = await import('./app.js');
let server: Server;
let base = '';
const H = { 'x-internal-key': 'k', 'x-user-id': '1', 'x-user-role': 'EDITOR', 'content-type': 'application/json' };

beforeAll(async () => {
  process.env.INTERNAL_API_KEY = 'k';
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => { calls.length = 0; deletedRow = true; });

describe('Admin địa điểm – thùng rác & khôi phục', () => {
  it('GET ?deleted=1 chỉ lấy địa điểm đã xóa mềm', async () => {
    const r = await fetch(`${base}/admin/locations?deleted=1`, { headers: H });
    expect(r.status).toBe(200);
    expect(calls[0].sql).toContain('l.deleted_at IS NOT NULL');
  });
  it('GET mặc định chỉ lấy địa điểm chưa xóa', async () => {
    await fetch(`${base}/admin/locations`, { headers: H });
    expect(calls[0].sql).toContain('l.deleted_at IS NULL');
    expect(calls[0].sql).not.toContain('IS NOT NULL');
  });
  it('deleted chỉ nhận 0/1', async () => {
    const r = await fetch(`${base}/admin/locations?deleted=abc`, { headers: H });
    expect(r.status).toBe(400);
  });
  it('PATCH restore: bỏ deleted_at, đưa về trạng thái ẩn, trả địa điểm', async () => {
    const r = await fetch(`${base}/admin/locations/14/restore`, { method: 'PATCH', headers: H });
    expect(r.status).toBe(200);
    expect(calls[0].sql).toMatch(/deleted_at = NULL, is_published = 0/);
    expect(calls[0].sql).toContain('deleted_at IS NOT NULL');
    expect((await r.json()).isPublished).toBe(false);
  });
  it('PATCH restore địa điểm không nằm trong thùng rác → 404', async () => {
    deletedRow = false;
    const r = await fetch(`${base}/admin/locations/99/restore`, { method: 'PATCH', headers: H });
    expect(r.status).toBe(404);
  });
  it('restore yêu cầu đăng nhập Admin', async () => {
    const r = await fetch(`${base}/admin/locations/14/restore`, { method: 'PATCH', headers: { 'x-internal-key': 'k' } });
    expect(r.status).toBe(401);
  });
});

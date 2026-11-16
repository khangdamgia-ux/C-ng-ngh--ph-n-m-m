import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const calls: Array<{ sql: string; params: Record<string, unknown> }> = [];
vi.mock('@hoian/shared', async (orig) => {
  const actual = await orig<typeof import('@hoian/shared')>();
  return {
    ...actual,
    query: vi.fn(async (sql: string, params: Record<string, unknown> = {}) => {
      calls.push({ sql, params });
      if (sql.includes('GROUP BY language_code')) return [{ language_code: 'vi', sessions: 11 }];
      return [];
    }),
  };
});

const { createApp } = await import('./app.js');
let server: Server;
let base = '';
const SID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const J = { 'content-type': 'application/json' };

beforeAll(() => {
  process.env.INTERNAL_API_KEY = 'k';
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => { calls.length = 0; });

describe('Ngôn ngữ của phiên', () => {
  it('heartbeat kèm ngôn ngữ → cập nhật language_code', async () => {
    const r = await fetch(`${base}/analytics/sessions/${SID}/heartbeat`, { method: 'POST', headers: J, body: JSON.stringify({ languageCode: 'en' }) });
    expect(r.status).toBe(204);
    expect(calls[0].params.lang).toBe('en');
  });
  it('heartbeat không có body vẫn chạy (client cũ)', async () => {
    const r = await fetch(`${base}/analytics/sessions/${SID}/heartbeat`, { method: 'POST' });
    expect(r.status).toBe(204);
    expect(calls[0].params.lang).toBeNull();
  });
  it('sự kiện kèm ngôn ngữ → phiên tạo trước cũng có ngôn ngữ', async () => {
    const r = await fetch(`${base}/analytics/events`, { method: 'POST', headers: J, body: JSON.stringify({ sessionId: SID, eventType: 'LOCATION_VIEW', languageCode: 'ko' }) });
    expect(r.status).toBe(202);
    expect(calls[0].params.lang).toBe('ko');
  });
  it('tab đóng/ẩn → kết thúc phiên ngay (expires_at = bây giờ)', async () => {
    const r = await fetch(`${base}/analytics/sessions/${SID}/end`, { method: 'POST' });
    expect(r.status).toBe(204);
    expect(calls[0].sql).toMatch(/SET expires_at = SYSUTCDATETIME\(\)/);
    expect(calls[0].params.id).toBe(SID);
  });
  it('mã phiên sai định dạng → 400', async () => {
    const r = await fetch(`${base}/analytics/sessions/abc/end`, { method: 'POST' });
    expect(r.status).toBe(400);
  });
  it('thống kê ngôn ngữ bỏ phiên không có ngôn ngữ (không còn "unknown")', async () => {
    const r = await fetch(`${base}/admin/stats/visits?groupBy=day`, { headers: { 'x-internal-key': 'k', 'x-user-id': '1', 'x-user-role': 'EDITOR' } });
    expect(r.status).toBe(200);
    const langSql = calls.find((c) => c.sql.includes('GROUP BY language_code'))!.sql;
    expect(langSql).toContain('language_code IS NOT NULL');
    const body = await r.json();
    expect(body.languages).toEqual([{ lang: 'vi', sessions: 11 }]);
    expect(JSON.stringify(body)).not.toContain('unknown');
  });
});

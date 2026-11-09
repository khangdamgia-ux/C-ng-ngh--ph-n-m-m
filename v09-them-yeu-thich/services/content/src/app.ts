import { z } from 'zod';
import {
  asyncHandler, callService, createBaseApp, createLogger, env, finalize, notFound,
  parse, query, requireInternalKey,
} from '@hoian/shared';
import { fallbackChain, pickByChain, type LanguageInfo } from './fallback.js';

const logger = createLogger('content');
const locationUrl = () => env('LOCATION_SERVICE_URL', 'http://localhost:4002');

interface NarrationRow {
  id: number;
  location_id: number;
  lang: string;
  title: string;
  summary: string | null;
  content: string;
  audio_url: string | null;
  audio_duration_s: number | null;
  status: 'DRAFT' | 'PUBLISHED';
  updated_at: Date;
}

const langParam = z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/, 'Mã ngôn ngữ không hợp lệ');
const NARRATION_SELECT = `SELECT n.id, n.location_id, g.code AS lang, n.title, n.summary, n.content, n.audio_url,
  n.audio_duration_s, n.status, n.updated_at FROM dbo.Narrations n JOIN dbo.Languages g ON g.id = n.language_id`;

const languages = () => query<LanguageInfo & { name: string }>('SELECT id, code, name, is_default, is_enabled, fallback_order FROM dbo.Languages');

const narrationDto = (n: NarrationRow, requested?: string) => ({
  id: n.id,
  language: n.lang,
  requestedLanguage: requested ?? n.lang,
  isFallback: requested ? n.lang !== requested : false,
  title: n.title,
  summary: n.summary,
  content: n.content,
  audio: n.audio_url ? { url: n.audio_url, durationSeconds: n.audio_duration_s } : null,
  status: n.status,
  updatedAt: n.updated_at,
});

export function createApp() {
  const app = createBaseApp('content');
  // ---------- API công khai ----------
  app.get(
    '/languages',
    asyncHandler(async (_req, res) => {
      const rows = (await languages()).filter((l) => l.is_enabled);
      res.json({ items: rows.map((l) => ({ code: l.code, name: l.name, isDefault: l.is_default })) });
    }),
  );

  // FR-03, FR-04: thuyết minh theo ngôn ngữ, có fallback. Gọi Location Service để kiểm tra địa điểm (East–West).
  app.get(
    '/locations/:code/narration',
    asyncHandler(async (req, res) => {
      const { lang } = parse(z.object({ lang: langParam.optional() }), req.query);
      const status = await callService<{ id: number; isPublished: boolean }>(
        'location-service', locationUrl(), `/internal/locations/${encodeURIComponent(req.params.code)}/status`, { requestId: req.requestId },
      );
      if (!status) throw notFound('Không tìm thấy địa điểm');
      if (!status.isPublished) throw notFound('Địa điểm tạm ngừng phục vụ');
      const chain = fallbackChain(lang, await languages());
      const items = await query<NarrationRow>(`${NARRATION_SELECT} WHERE n.location_id = @id AND n.status = 'PUBLISHED'`, { id: status.id });
      const best = pickByChain(items, chain);
      if (!best) throw notFound('Địa điểm chưa có nội dung thuyết minh');
      res.json({ locationCode: req.params.code, locationId: status.id, ...narrationDto(best, lang ?? chain[0]) });
    }),
  );

  // ---------- API nội bộ ----------
  app.get(
    '/internal/narrations/summaries',
    requireInternalKey,
    asyncHandler(async (req, res) => {
      const ids = String(req.query.ids ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
      const lang = typeof req.query.lang === 'string' && req.query.lang ? req.query.lang : undefined;
      if (!ids.length) return res.json({ items: {} });
      const chain = fallbackChain(lang, await languages());
      const rows = await query<NarrationRow>(
        `${NARRATION_SELECT} WHERE n.status = 'PUBLISHED' AND n.location_id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ','))`,
        { ids: ids.join(',') },
      );
      const items: Record<number, unknown> = {};
      for (const id of ids) {
        const best = pickByChain(rows.filter((r) => r.location_id === id), chain);
        if (best) items[id] = { title: best.title, summary: best.summary, language: best.lang, isFallback: best.lang !== (lang ?? chain[0]) };
      }
      res.json({ items });
    }),
  );

  app.get(
    '/internal/narrations/search',
    requireInternalKey,
    asyncHandler(async (req, res) => {
      const q = String(req.query.q ?? '').trim().slice(0, 100).replace(/[[\]%_]/g, (m) => `[${m}]`);
      const lang = String(req.query.lang ?? '') || 'vi';
      if (!q) return res.json({ ids: [] });
      const rows = await query<{ location_id: number }>(
        `SELECT DISTINCT n.location_id FROM dbo.Narrations n JOIN dbo.Languages g ON g.id = n.language_id
         WHERE n.status = 'PUBLISHED' AND g.code IN (@lang, 'vi', 'en')
           AND (n.title LIKE N'%' + @q + N'%' OR n.summary LIKE N'%' + @q + N'%')`,
        { q, lang },
      );
      res.json({ ids: rows.map((r) => r.location_id) });
    }),
  );

  return finalize(app, logger);
}

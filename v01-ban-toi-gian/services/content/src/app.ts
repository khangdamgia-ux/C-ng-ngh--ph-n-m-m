import {
  asyncHandler, callService, createBaseApp, createLogger, env, finalize, notFound,
  query, requireInternalKey,
} from '@hoian/shared';

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

const NARRATION_SELECT = `SELECT n.id, n.location_id, g.code AS lang, n.title, n.summary, n.content, n.audio_url,
  n.audio_duration_s, n.status, n.updated_at FROM dbo.Narrations n JOIN dbo.Languages g ON g.id = n.language_id
  WHERE g.is_default = 1`; // chỉ dùng ngôn ngữ mặc định (Tiếng Việt)

const narrationDto = (n: NarrationRow) => ({
  id: n.id,
  language: n.lang,
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
  // FR-04: thuyết minh của địa điểm. Gọi Location Service để kiểm tra địa điểm (East–West).
  app.get(
    '/locations/:code/narration',
    asyncHandler(async (req, res) => {
      const status = await callService<{ id: number; isPublished: boolean }>(
        'location-service', locationUrl(), `/internal/locations/${encodeURIComponent(req.params.code)}/status`, { requestId: req.requestId },
      );
      if (!status) throw notFound('Không tìm thấy địa điểm');
      if (!status.isPublished) throw notFound('Địa điểm tạm ngừng phục vụ');
      const [best] = await query<NarrationRow>(`${NARRATION_SELECT} AND n.location_id = @id AND n.status = 'PUBLISHED'`, { id: status.id });
      if (!best) throw notFound('Địa điểm chưa có nội dung thuyết minh');
      res.json({ locationCode: req.params.code, locationId: status.id, ...narrationDto(best) });
    }),
  );

  // ---------- API nội bộ ----------
  app.get(
    '/internal/narrations/summaries',
    requireInternalKey,
    asyncHandler(async (req, res) => {
      const ids = String(req.query.ids ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
      if (!ids.length) return res.json({ items: {} });
      const rows = await query<NarrationRow>(
        `${NARRATION_SELECT} AND n.status = 'PUBLISHED' AND n.location_id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ','))`,
        { ids: ids.join(',') },
      );
      const items: Record<number, unknown> = {};
      for (const r of rows) items[r.location_id] = { title: r.title, summary: r.summary, language: r.lang };
      res.json({ items });
    }),
  );

  return finalize(app, logger);
}

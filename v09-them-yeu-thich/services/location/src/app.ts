import { z } from 'zod';
import {
  asyncHandler, AppError, callService, createBaseApp, createLogger, env, finalize, haversine, notFound, parse,
  query, requireInternalKey,
} from '@hoian/shared';

const logger = createLogger('location');
const contentUrl = () => env('CONTENT_SERVICE_URL', 'http://localhost:4003');

interface LocationRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category_id: number;
  category_code: string;
  category_name: string;
  trigger_radius_m: number;
  priority: number;
  opening_hours: string | null;
  ticket_price: number | null;
  image_url: string | null;
  is_published: boolean;
  updated_at: Date;
  total?: number;
}

type Summary = { title: string; summary: string | null; language: string; isFallback: boolean };

const SELECT = `SELECT l.*, c.code AS category_code, c.name AS category_name
  FROM dbo.Locations l JOIN dbo.LocationCategories c ON c.id = l.category_id`;

function toDto(r: LocationRow, s?: Summary) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    title: s?.title ?? r.name,
    summary: s?.summary ?? null,
    language: s?.language ?? null,
    isFallback: s?.isFallback ?? false,
    category: { id: r.category_id, code: r.category_code, name: r.category_name },
    address: r.address,
    latitude: r.latitude === null ? null : Number(r.latitude),
    longitude: r.longitude === null ? null : Number(r.longitude),
    triggerRadiusM: r.trigger_radius_m,
    priority: r.priority,
    openingHours: r.opening_hours,
    ticketPrice: r.ticket_price === null ? null : Number(r.ticket_price),
    imageUrl: r.image_url,
  };
}

const escapeLike = (q: string) => q.replace(/[[\]%_]/g, (m) => `[${m}]`);
const langSchema = z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/).optional();

export function createApp() {
  const app = createBaseApp('location');
  /** Lấy tiêu đề/tóm tắt theo ngôn ngữ từ Content Service; nếu Content lỗi → suy giảm có kiểm soát. */
  async function summaries(ids: number[], lang: string | undefined, requestId: string) {
    if (!ids.length) return { map: new Map<number, Summary>(), degraded: false };
    try {
      const data = await callService<{ items: Record<string, Summary> }>(
        'content-service', contentUrl(), `/internal/narrations/summaries?lang=${lang ?? ''}&ids=${ids.join(',')}`, { requestId },
      );
      return { map: new Map(Object.entries(data?.items ?? {}).map(([k, v]) => [Number(k), v])), degraded: false };
    } catch (err) {
      logger.warn('Không lấy được tóm tắt từ Content Service', { requestId, err: String(err) });
      return { map: new Map<number, Summary>(), degraded: true };
    }
  }

  // FR-06, FR-07, FR-08: danh sách địa điểm công khai + tìm kiếm + lọc
  app.get(
    '/locations',
    asyncHandler(async (req, res) => {
      const q = parse(
        z.object({
          q: z.string().trim().max(100).optional(),
          category: z.string().max(50).optional(),
          lang: langSchema,
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        req.query,
      );
      let matchedIds: number[] = [];
      if (q.q) {
        try {
          const found = await callService<{ ids: number[] }>(
            'content-service', contentUrl(), `/internal/narrations/search?lang=${q.lang ?? ''}&q=${encodeURIComponent(q.q)}`, { requestId: req.requestId },
          );
          matchedIds = found?.ids ?? [];
        } catch {
          /* Content lỗi: vẫn tìm theo tên gốc */
        }
      }
      const rows = await query<LocationRow>(
        `${SELECT}
         WHERE l.is_published = 1 AND l.deleted_at IS NULL
           AND (@category IS NULL OR c.code = @category)
           AND (@q IS NULL OR l.name LIKE N'%' + @q + N'%' OR l.id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ',')))
         ORDER BY l.priority DESC, c.sort_order, l.id
         OFFSET (@page - 1) * @pageSize ROWS FETCH NEXT @pageSize ROWS ONLY`,
        { category: q.category ?? null, q: q.q ? escapeLike(q.q) : null, ids: matchedIds.join(','), page: q.page, pageSize: q.pageSize },
      );
      const [{ total }] = await query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM dbo.Locations l JOIN dbo.LocationCategories c ON c.id = l.category_id
         WHERE l.is_published = 1 AND l.deleted_at IS NULL AND (@category IS NULL OR c.code = @category)
           AND (@q IS NULL OR l.name LIKE N'%' + @q + N'%' OR l.id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, ',')))`,
        { category: q.category ?? null, q: q.q ? escapeLike(q.q) : null, ids: matchedIds.join(',') },
      );
      const { map, degraded } = await summaries(rows.map((r) => r.id), q.lang, req.requestId);
      res.json({ items: rows.map((r) => toDto(r, map.get(r.id))), page: q.page, pageSize: q.pageSize, total, contentDegraded: degraded });
    }),
  );

  app.get(
    '/categories',
    asyncHandler(async (_req, res) => {
      res.json({ items: await query('SELECT id, code, name, sort_order AS sortOrder FROM dbo.LocationCategories ORDER BY sort_order') });
    }),
  );

  // Địa điểm gần (dự phòng khi dữ liệu lớn – PRD 16.1)
  app.get(
    '/locations/nearby',
    asyncHandler(async (req, res) => {
      const q = parse(z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180), radius: z.coerce.number().min(1).max(5000).default(500), lang: langSchema }), req.query);
      const rows = await query<LocationRow>(`${SELECT} WHERE l.is_published = 1 AND l.deleted_at IS NULL AND l.latitude IS NOT NULL`);
      const near = rows
        .map((r) => ({ r, d: haversine({ lat: q.lat, lng: q.lng }, { lat: Number(r.latitude), lng: Number(r.longitude) }) }))
        .filter((x) => x.d <= q.radius)
        .sort((a, b) => a.d - b.d);
      const { map } = await summaries(near.map((x) => x.r.id), q.lang, req.requestId);
      res.json({ items: near.map((x) => ({ ...toDto(x.r, map.get(x.r.id)), distanceM: Math.round(x.d) })) });
    }),
  );

  // FR-10: chi tiết địa điểm
  app.get(
    '/locations/:code',
    asyncHandler(async (req, res) => {
      const { lang } = parse(z.object({ lang: langSchema }), req.query);
      const [row] = await query<LocationRow>(`${SELECT} WHERE l.code = @code AND l.deleted_at IS NULL`, { code: req.params.code });
      if (!row) throw notFound('Không tìm thấy địa điểm');
      if (!row.is_published) throw new AppError(404, 'NOT_FOUND', 'Địa điểm tạm ngừng phục vụ');
      const { map, degraded } = await summaries([row.id], lang, req.requestId);
      res.json({ ...toDto(row, map.get(row.id)), contentDegraded: degraded });
    }),
  );

  // ---------- API nội bộ (East–West) ----------
  app.get(
    '/internal/locations/:code/status',
    requireInternalKey,
    asyncHandler(async (req, res) => {
      const [row] = await query<{ id: number; code: string; is_published: boolean }>(
        'SELECT id, code, is_published FROM dbo.Locations WHERE code = @code AND deleted_at IS NULL', { code: req.params.code },
      );
      if (!row) throw notFound();
      res.json({ id: row.id, code: row.code, isPublished: row.is_published });
    }),
  );

  return finalize(app, logger);
}

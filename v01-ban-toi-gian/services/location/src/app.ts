import { z } from 'zod';
import {
  asyncHandler, AppError, callService, createBaseApp, createLogger, env, finalize, notFound, parse,
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

type Summary = { title: string; summary: string | null; language: string };

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


export function createApp() {
  const app = createBaseApp('location');
  /** Lấy tiêu đề/tóm tắt từ Content Service; nếu Content lỗi → suy giảm có kiểm soát. */
  async function summaries(ids: number[], requestId: string) {
    if (!ids.length) return { map: new Map<number, Summary>(), degraded: false };
    try {
      const data = await callService<{ items: Record<string, Summary> }>(
        'content-service', contentUrl(), `/internal/narrations/summaries?ids=${ids.join(',')}`, { requestId },
      );
      return { map: new Map(Object.entries(data?.items ?? {}).map(([k, v]) => [Number(k), v])), degraded: false };
    } catch (err) {
      logger.warn('Không lấy được tóm tắt từ Content Service', { requestId, err: String(err) });
      return { map: new Map<number, Summary>(), degraded: true };
    }
  }

  // FR-06: danh sách địa điểm công khai
  app.get(
    '/locations',
    asyncHandler(async (req, res) => {
      const q = parse(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        }),
        req.query,
      );
      const rows = await query<LocationRow>(
        `${SELECT}
         WHERE l.is_published = 1 AND l.deleted_at IS NULL
         ORDER BY l.priority DESC, c.sort_order, l.id
         OFFSET (@page - 1) * @pageSize ROWS FETCH NEXT @pageSize ROWS ONLY`,
        { page: q.page, pageSize: q.pageSize },
      );
      const [{ total }] = await query<{ total: number }>(
        'SELECT COUNT(*) AS total FROM dbo.Locations l WHERE l.is_published = 1 AND l.deleted_at IS NULL',
      );
      const { map, degraded } = await summaries(rows.map((r) => r.id), req.requestId);
      res.json({ items: rows.map((r) => toDto(r, map.get(r.id))), page: q.page, pageSize: q.pageSize, total, contentDegraded: degraded });
    }),
  );

  // FR-10: chi tiết địa điểm
  app.get(
    '/locations/:code',
    asyncHandler(async (req, res) => {
      const [row] = await query<LocationRow>(`${SELECT} WHERE l.code = @code AND l.deleted_at IS NULL`, { code: req.params.code });
      if (!row) throw notFound('Không tìm thấy địa điểm');
      if (!row.is_published) throw new AppError(404, 'NOT_FOUND', 'Địa điểm tạm ngừng phục vụ');
      const { map, degraded } = await summaries([row.id], req.requestId);
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

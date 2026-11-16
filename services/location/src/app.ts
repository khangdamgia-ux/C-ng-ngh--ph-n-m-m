import QRCode from 'qrcode';
import { z } from 'zod';
import {
  asyncHandler, AppError, callService, conflict, createBaseApp, createLogger, env, finalize, haversine, notFound, parse,
  query, requireInternalKey, requireRole,
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
 
 const admin = [requireInternalKey, requireRole('SUPER_ADMIN', 'EDITOR')];
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
  app.get(
    '/internal/locations/by-id/:id/status',
    requireInternalKey,
    asyncHandler(async (req, res) => {
      const [row] = await query<{ id: number; code: string; is_published: boolean }>(
        'SELECT id, code, is_published FROM dbo.Locations WHERE id = @id AND deleted_at IS NULL', { id: Number(req.params.id) || 0 },
      );
      if (!row) throw notFound();
      res.json({ id: row.id, code: row.code, isPublished: row.is_published });
    }),
  );
  app.get(
    '/internal/locations/names',
    requireInternalKey,
    asyncHandler(async (req, res) => {
      const ids = String(req.query.ids ?? '');
      const rows = await query<{ id: number; code: string; name: string }>(
        'SELECT id, code, name FROM dbo.Locations WHERE id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, \',\'))', { ids },
      );
      res.json({ items: rows });
    }),
  );

  // ---------- API quản trị (FR-14, FR-17) ----------
  app.post(
  '/admin/categories',
  ...admin,
  asyncHandler(async (req, res) => {
    const { name } = parse(
      z.object({
        name: z.string().trim().min(1, 'Tên loại là bắt buộc').max(150),
      }),
      req.body,
    );

    const existing = await query<{ id: number; code: string; name: string }>(
      `SELECT TOP 1 id, code, name
       FROM dbo.LocationCategories
       WHERE name COLLATE Vietnamese_CI_AI = @name COLLATE Vietnamese_CI_AI`,
      { name },
    );

    if (existing.length > 0) {
      return res.json(existing[0]);
    }

    const baseCode = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);

    const code = `${baseCode || 'category'}-${Date.now().toString(36)}`;

    const [category] = await query<{ id: number; code: string; name: string }>(
      `INSERT INTO dbo.LocationCategories (code, name, sort_order)
       OUTPUT INSERTED.id, INSERTED.code, INSERTED.name
       VALUES (@code, @name, 999)`,
      { code, name },
    );

    res.status(201).json(category);
  }),
);
  const slug = z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Chỉ dùng chữ thường không dấu, số và dấu gạch ngang');
  const base = z.object({
    name: z.string().trim().min(1, 'Tên địa điểm là bắt buộc').max(200),
    categoryId: z.coerce.number().int().positive(),
    description: z.string().max(4000).nullish(),
    address: z.string().max(300).nullish(),
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    triggerRadiusM: z.number().int().min(5).max(200).default(25),
    priority: z.number().int().min(0).max(100).default(0),
    openingHours: z.string().max(500).nullish(),
    ticketPrice: z.number().min(0).nullish(),
    imageUrl: z.string().url().max(1000).nullish(),
    isPublished: z.boolean().default(false),
  });

  async function adminGet(id: number) {
    const [row] = await query<LocationRow>(`${SELECT} WHERE l.id = @id AND l.deleted_at IS NULL`, { id });
    if (!row) throw notFound('Không tìm thấy địa điểm');
    return { ...toDto(row), description: row.description, isPublished: row.is_published, updatedAt: row.updated_at };
  }

  app.get(
    '/admin/locations',
    ...admin,
    asyncHandler(async (req, res) => {
      const q = parse(z.object({ q: z.string().trim().max(100).optional(), deleted: z.enum(['0', '1']).default('0') }), req.query);
      // deleted=1: danh sách địa điểm đã xóa mềm (thùng rác) để Admin khôi phục.
      const rows = await query<LocationRow>(
        `${SELECT} WHERE ${q.deleted === '1' ? 'l.deleted_at IS NOT NULL' : 'l.deleted_at IS NULL'} AND (@q IS NULL OR l.name LIKE N'%' + @q + N'%' OR l.code LIKE '%' + @q + '%') ORDER BY l.id`,
        { q: q.q ? escapeLike(q.q) : null },
      );
      res.json({ items: rows.map((r) => ({ ...toDto(r), isPublished: r.is_published, updatedAt: r.updated_at })) });
    }),
  );

  app.get('/admin/locations/:id', ...admin, asyncHandler(async (req, res) => res.json(await adminGet(Number(req.params.id) || 0))));

  const params = (b: z.infer<typeof base>) => ({
    name: b.name, categoryId: b.categoryId, description: b.description ?? null, address: b.address ?? null,
    lat: b.latitude ?? null, lng: b.longitude ?? null, radius: b.triggerRadiusM, priority: b.priority,
    hours: b.openingHours ?? null, price: b.ticketPrice ?? null, image: b.imageUrl ?? null, pub: b.isPublished,
  });

  async function guard<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (err) {
      const num = (err as { number?: number }).number;
      if (num === 2627 || num === 2601) throw conflict('Mã địa điểm (code) đã tồn tại');
      if (num === 547) throw new AppError(400, 'VALIDATION_ERROR', 'Dữ liệu vi phạm ràng buộc (loại địa điểm, tọa độ hoặc bán kính)');
      throw err;
    }
  }

  app.post(
    '/admin/locations',
    ...admin,
    asyncHandler(async (req, res) => {
      const b = parse(base.extend({ code: slug }), req.body);
      const [row] = await guard(() =>
        query<{ id: number }>(
          `INSERT INTO dbo.Locations (code, name, category_id, description, address, latitude, longitude, trigger_radius_m, priority,
             opening_hours, ticket_price, image_url, is_published)
           OUTPUT INSERTED.id
           VALUES (@code, @name, @categoryId, @description, @address, @lat, @lng, @radius, @priority, @hours, @price, @image, @pub)`,
          { code: b.code, ...params(b) },
        ),
      );
      res.status(201).json(await adminGet(row.id));
    }),
  );

  // Không cho đổi code sau khi tạo vì code đã in trên mã QR (FR-01)
  app.put(
    '/admin/locations/:id',
    ...admin,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id) || 0;
      const b = parse(base, req.body);
      const rows = await guard(() =>
        query<{ id: number }>(
          `UPDATE dbo.Locations SET name = @name, category_id = @categoryId, description = @description, address = @address,
             latitude = @lat, longitude = @lng, trigger_radius_m = @radius, priority = @priority, opening_hours = @hours,
             ticket_price = @price, image_url = @image, is_published = @pub, updated_at = SYSUTCDATETIME()
           OUTPUT INSERTED.id WHERE id = @id AND deleted_at IS NULL`,
          { id, ...params(b) },
        ),
      );
      if (!rows.length) throw notFound('Không tìm thấy địa điểm');
      res.json(await adminGet(id));
    }),
  );

  // Xóa mềm – giữ Narrations và VisitEvents cho thống kê (PRD 10.3)
  app.delete(
    '/admin/locations/:id',
    ...admin,
    asyncHandler(async (req, res) => {
      const rows = await query(
        'UPDATE dbo.Locations SET deleted_at = SYSUTCDATETIME(), is_published = 0 OUTPUT INSERTED.id WHERE id = @id AND deleted_at IS NULL',
        { id: Number(req.params.id) || 0 },
      );
      if (!rows.length) throw notFound('Không tìm thấy địa điểm');
      res.status(204).end();
    }),
  );

  // Khôi phục địa điểm đã xóa mềm – trở lại ở trạng thái ẩn để Admin kiểm tra trước khi công khai.
  app.patch(
    '/admin/locations/:id/restore',
    ...admin,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id) || 0;
      const rows = await query(
        'UPDATE dbo.Locations SET deleted_at = NULL, is_published = 0, updated_at = SYSUTCDATETIME() OUTPUT INSERTED.id WHERE id = @id AND deleted_at IS NOT NULL',
        { id },
      );
      if (!rows.length) throw notFound('Không tìm thấy địa điểm trong thùng rác');
      res.json(await adminGet(id));
    }),
  );

  app.patch(
    '/admin/locations/:id/publish',
    ...admin,
    asyncHandler(async (req, res) => {
      const { isPublished } = parse(z.object({ isPublished: z.boolean() }), req.body);
      const id = Number(req.params.id) || 0;
      const rows = await query('UPDATE dbo.Locations SET is_published = @p, updated_at = SYSUTCDATETIME() OUTPUT INSERTED.id WHERE id = @id AND deleted_at IS NULL', { id, p: isPublished });
      if (!rows.length) throw notFound('Không tìm thấy địa điểm');
      res.json(await adminGet(id));
    }),
  );

  app.put(
    '/admin/locations/:id/geo',
    ...admin,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id) || 0;
      const b = parse(
        z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), triggerRadiusM: z.number().int().min(5).max(200), priority: z.number().int().min(0).max(100).optional() }),
        req.body,
      );
      const rows = await query(
        `UPDATE dbo.Locations SET latitude = @lat, longitude = @lng, trigger_radius_m = @r, priority = COALESCE(@p, priority), updated_at = SYSUTCDATETIME()
         OUTPUT INSERTED.id WHERE id = @id AND deleted_at IS NULL`,
        { id, lat: b.latitude, lng: b.longitude, r: b.triggerRadiusM, p: b.priority ?? null },
      );
      if (!rows.length) throw notFound('Không tìm thấy địa điểm');
      res.json(await adminGet(id));
    }),
  );

  // FR-17: tải mã QR của địa điểm (PNG/SVG)
  app.get(
    '/admin/locations/:id/qr',
    ...admin,
    asyncHandler(async (req, res) => {
      const { format } = parse(z.object({ format: z.enum(['png', 'svg']).default('png') }), req.query);
      const loc = await adminGet(Number(req.params.id) || 0);
      const url = `${(process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '')}/l/${loc.code}?src=qr`;
      res.setHeader('Content-Disposition', `attachment; filename="qr-${loc.code}.${format}"`);
      if (format === 'svg') {
        res.type('image/svg+xml').send(await QRCode.toString(url, { type: 'svg', margin: 2, width: 512 }));
      } else {
        res.type('image/png').send(await QRCode.toBuffer(url, { margin: 2, width: 1024 }));
      }
    }),
  );

  return finalize(app, logger);
}

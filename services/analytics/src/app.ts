import { z } from 'zod';
import {
  asyncHandler, callService, createBaseApp, createLogger, env, finalize, parse, query, requireInternalKey, requireRole,
} from '@hoian/shared';

const logger = createLogger('analytics');
const locationUrl = () => env('LOCATION_SERVICE_URL', 'http://localhost:4002');

/** Phiên hết hạn sau 120 giây không có heartbeat (FR-18). */
export const SESSION_TIMEOUT_S = 120;
export const EVENT_TYPES = ['QR_SCAN', 'TOUR_START', 'LOCATION_VIEW', 'AUDIO_PLAY', 'AUDIO_COMPLETE', 'GEOFENCE_TRIGGER', 'LANGUAGE_CHANGE'] as const;

const sessionId = z.string().regex(/^[A-Za-z0-9-]{8,64}$/, 'sessionId không hợp lệ');

export function createApp() {
  const app = createBaseApp('analytics');

  // Tạo/cập nhật phiên. KHÔNG lưu IP hay tọa độ người dùng (NFR-09).
  async function upsertSession(id: string, languageCode: string | null, source: string | null, simulated: boolean) {
    // HOLDLOCK: MERGE mặc định KHÔNG an toàn khi 2 yêu cầu cùng tạo một phiên (trình duyệt gửi “tạo phiên” và “sự kiện” gần như đồng thời)
    // → một bên lỗi trùng khóa và sự kiện bị mất. Khóa + thử lại khi vẫn đụng độ.
    for (let attempt = 0; ; attempt++) {
      try {
        return await mergeSession(id, languageCode, source, simulated);
      } catch (err) {
        const n = (err as { number?: number }).number;
        if ((n === 2627 || n === 2601 || n === 1205) && attempt < 2) continue;
        throw err;
      }
    }
  }

  async function mergeSession(id: string, languageCode: string | null, source: string | null, simulated: boolean) {
    await query(
      `MERGE dbo.VisitSessions WITH (HOLDLOCK) AS t USING (SELECT @id AS session_id) AS s ON t.session_id = s.session_id
       WHEN MATCHED THEN UPDATE SET last_seen_at = SYSUTCDATETIME(), expires_at = DATEADD(SECOND, @timeout, SYSUTCDATETIME()),
         language_code = COALESCE(@lang, t.language_code), is_simulated = CASE WHEN @sim = 1 THEN 1 ELSE t.is_simulated END
       WHEN NOT MATCHED THEN INSERT (session_id, started_at, last_seen_at, expires_at, language_code, source, is_simulated)
         VALUES (@id, SYSUTCDATETIME(), SYSUTCDATETIME(), DATEADD(SECOND, @timeout, SYSUTCDATETIME()), @lang, @source, @sim);`,
      { id, lang: languageCode, source, sim: simulated, timeout: SESSION_TIMEOUT_S },
    );
  }

  app.post(
    '/analytics/sessions',
    asyncHandler(async (req, res) => {
      const b = parse(
        z.object({ sessionId, languageCode: z.string().max(10).nullish(), source: z.enum(['QR', 'DIRECT']).nullish(), isSimulated: z.boolean().default(false) }),
        req.body,
      );
      await upsertSession(b.sessionId, b.languageCode ?? null, b.source ?? null, b.isSimulated);
      res.status(201).json({ sessionId: b.sessionId, timeoutSeconds: SESSION_TIMEOUT_S });
    }),
  );

  app.post(
    '/analytics/sessions/:id/heartbeat',
    asyncHandler(async (req, res) => {
      const id = parse(sessionId, req.params.id);
      // Heartbeat kèm ngôn ngữ hiện tại → bù cho phiên lỡ bị tạo trước mà chưa có ngôn ngữ (không được tính vào thống kê ngôn ngữ).
      const { languageCode } = parse(z.object({ languageCode: z.string().max(10).nullish() }), req.body ?? {});
      await upsertSession(id, languageCode ?? null, null, false);
      res.status(204).end();
    }),
  );

  // Tab bị đóng/ẩn → kết thúc phiên ngay (không chờ 120 giây). Tab hiện lại thì heartbeat làm phiên “sống” lại.
  app.post(
    '/analytics/sessions/:id/end',
    asyncHandler(async (req, res) => {
      const id = parse(sessionId, req.params.id);
      await query('UPDATE dbo.VisitSessions SET expires_at = SYSUTCDATETIME(), last_seen_at = SYSUTCDATETIME() WHERE session_id = @id AND expires_at > SYSUTCDATETIME()', { id });
      res.status(204).end();
    }),
  );

  app.post(
    '/analytics/events',
    asyncHandler(async (req, res) => {
      const b = parse(
        z.object({ sessionId, eventType: z.enum(EVENT_TYPES), locationId: z.number().int().positive().nullish(), languageCode: z.string().max(10).nullish(), isSimulated: z.boolean().default(false) }),
        req.body,
      );
      await upsertSession(b.sessionId, b.languageCode ?? null, null, b.isSimulated);
      try {
        await query('INSERT INTO dbo.VisitEvents (session_id, location_id, event_type) VALUES (@s, @l, @t)', {
          s: b.sessionId, l: b.locationId ?? null, t: b.eventType,
        });
      } catch (err) {
        // locationId không tồn tại → vẫn ghi sự kiện nhưng bỏ địa điểm
        if ((err as { number?: number }).number !== 547) throw err;
        await query('INSERT INTO dbo.VisitEvents (session_id, location_id, event_type) VALUES (@s, NULL, @t)', { s: b.sessionId, t: b.eventType });
      }
      res.status(202).json({ accepted: true });
    }),
  );

  // ---------- Thống kê cho Admin (FR-18, FR-19) – loại phiên mô phỏng (FR-21) ----------
  const admin = [requireInternalKey, requireRole('SUPER_ADMIN', 'EDITOR')];

  app.get(
    '/admin/stats/active-sessions',
    ...admin,
    asyncHandler(async (_req, res) => {
      const [row] = await query<{ active: number }>(
        'SELECT COUNT(*) AS active FROM dbo.VisitSessions WHERE expires_at > SYSUTCDATETIME() AND is_simulated = 0',
      );
      // Chi tiết để Admin đối chiếu (ẩn danh: chỉ 8 ký tự đầu của mã phiên, không IP/tọa độ).
      const items = await query<{ session_id: string; language_code: string | null; source: string | null; started_at: Date; last_seen_at: Date }>(
        `SELECT TOP 20 session_id, language_code, source, started_at, last_seen_at FROM dbo.VisitSessions
         WHERE expires_at > SYSUTCDATETIME() AND is_simulated = 0 ORDER BY last_seen_at DESC`,
      );
      res.json({
        activeSessions: row.active, timeoutSeconds: SESSION_TIMEOUT_S, note: 'Số phiên không đồng nghĩa số người duy nhất',
        items: items.map((s) => ({ id: s.session_id.slice(0, 8), lang: s.language_code, source: s.source, startedAt: s.started_at, lastSeenAt: s.last_seen_at })),
      });
    }),
  );

  const range = z.object({
    from: z.coerce.date().default(() => new Date(Date.now() - 6 * 86_400_000)),
    to: z.coerce.date().default(() => new Date()),
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
  });

  app.get(
    '/admin/stats/visits',
    ...admin,
    asyncHandler(async (req, res) => {
      const q = parse(range, req.query);
      // Gom nhóm theo múi giờ Việt Nam (UTC+7); dữ liệu lưu UTC
      const bucket = {
        day: 'CAST(DATEADD(HOUR, 7, x.t) AS DATE)',
        week: 'DATEADD(DAY, -((DATEPART(WEEKDAY, DATEADD(HOUR, 7, x.t)) + @@DATEFIRST - 2) % 7), CAST(DATEADD(HOUR, 7, x.t) AS DATE))',
        month: 'DATEFROMPARTS(YEAR(DATEADD(HOUR, 7, x.t)), MONTH(DATEADD(HOUR, 7, x.t)), 1)',
      }[q.groupBy];
      const rows = await query<Record<string, number | Date>>(
        `WITH x AS (
           SELECT s.started_at AS t, 'SESSION' AS k FROM dbo.VisitSessions s WHERE s.is_simulated = 0 AND s.started_at BETWEEN @from AND @to
           UNION ALL
           SELECT e.created_at, e.event_type FROM dbo.VisitEvents e JOIN dbo.VisitSessions s ON s.session_id = e.session_id
           WHERE s.is_simulated = 0 AND e.created_at BETWEEN @from AND @to)
         SELECT ${bucket} AS period,
           SUM(CASE WHEN k = 'SESSION' THEN 1 ELSE 0 END) AS sessions,
           SUM(CASE WHEN k = 'QR_SCAN' THEN 1 ELSE 0 END) AS qrScans,
           SUM(CASE WHEN k = 'TOUR_START' THEN 1 ELSE 0 END) AS tourStarts,
           SUM(CASE WHEN k = 'LOCATION_VIEW' THEN 1 ELSE 0 END) AS locationViews,
           SUM(CASE WHEN k = 'AUDIO_PLAY' THEN 1 ELSE 0 END) AS audioPlays,
           SUM(CASE WHEN k = 'AUDIO_COMPLETE' THEN 1 ELSE 0 END) AS audioCompletes,
           SUM(CASE WHEN k = 'GEOFENCE_TRIGGER' THEN 1 ELSE 0 END) AS geofenceTriggers
         FROM x GROUP BY ${bucket} ORDER BY period`,
        { from: q.from, to: q.to },
      );
      const langs = await query<{ language_code: string | null; sessions: number }>(
        `SELECT language_code, COUNT(*) AS sessions FROM dbo.VisitSessions
         WHERE is_simulated = 0 AND language_code IS NOT NULL AND started_at BETWEEN @from AND @to GROUP BY language_code ORDER BY sessions DESC`,
        { from: q.from, to: q.to },
      );
      res.json({ from: q.from, to: q.to, groupBy: q.groupBy, items: rows, languages: langs.map((l) => ({ lang: l.language_code as string, sessions: l.sessions })) });
    }),
  );

  app.get(
    '/admin/stats/top-locations',
    ...admin,
    asyncHandler(async (req, res) => {
      const q = parse(range, req.query);
      const rows = await query<{ location_id: number; plays: number; views: number }>(
        `SELECT TOP 10 e.location_id,
           SUM(CASE WHEN e.event_type IN ('AUDIO_PLAY','GEOFENCE_TRIGGER') THEN 1 ELSE 0 END) AS plays,
           SUM(CASE WHEN e.event_type = 'LOCATION_VIEW' THEN 1 ELSE 0 END) AS views
         FROM dbo.VisitEvents e JOIN dbo.VisitSessions s ON s.session_id = e.session_id
         WHERE s.is_simulated = 0 AND e.location_id IS NOT NULL AND e.created_at BETWEEN @from AND @to
         GROUP BY e.location_id ORDER BY plays DESC, views DESC`,
        { from: q.from, to: q.to },
      );
      // Lấy tên địa điểm từ Location Service (East–West); lỗi thì vẫn trả số liệu
      let names = new Map<number, string>();
      if (rows.length) {
        try {
          const data = await callService<{ items: { id: number; name: string }[] }>(
            'location-service', locationUrl(), `/internal/locations/names?ids=${rows.map((r) => r.location_id).join(',')}`, { requestId: req.requestId },
          );
          names = new Map((data?.items ?? []).map((i) => [i.id, i.name]));
        } catch (err) {
          logger.warn('Không lấy được tên địa điểm', { err: String(err) });
        }
      }
      res.json({ items: rows.map((r) => ({ locationId: r.location_id, name: names.get(r.location_id) ?? `#${r.location_id}`, plays: r.plays, views: r.views })) });
    }),
  );

  return finalize(app, logger);
}

import { mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  AppError, asyncHandler, badRequest, callService, conflict, createBaseApp, createLogger, env, finalize, getPool, notFound,
  parse, query, requireInternalKey, requireRole, sql,
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
  const mediaDir = resolve(process.env.MEDIA_DIR ?? './media');
  mkdirSync(join(mediaDir, 'audio'), { recursive: true });

  // Phục vụ file âm thanh (hỗ trợ HTTP Range để tua – FR-04)
  app.use('/media', express.static(mediaDir, { maxAge: '7d', fallthrough: false }));

  // ---------- API công khai ----------
  app.get(
    '/languages',
    asyncHandler(async (_req, res) => {
      const rows = (await languages()).filter((l) => l.is_enabled);
      res.json({ items: rows.map((l) => ({ code: l.code, name: l.name, isDefault: l.is_default })) });
    }),
  );

  app.get(
    '/ui-translations',
    asyncHandler(async (req, res) => {
      const { lang } = parse(z.object({ lang: langParam }), req.query);
      const rows = await query<{ key: string; value: string }>(
        'SELECT t.[key], t.value FROM dbo.UiTranslations t JOIN dbo.Languages g ON g.id = t.language_id WHERE g.code = @lang AND g.is_enabled = 1',
        { lang },
      );
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json({ lang, items: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
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

  // ---------- API quản trị (FR-15, FR-16) ----------
  const editor = [requireInternalKey, requireRole('SUPER_ADMIN', 'EDITOR')];
  const superAdmin = [requireInternalKey, requireRole('SUPER_ADMIN')];

  async function assertLocation(id: number, requestId: string) {
    const loc = await callService<{ id: number; code: string }>('location-service', locationUrl(), `/internal/locations/by-id/${id}/status`, { requestId });
    if (!loc) throw notFound('Không tìm thấy địa điểm');
    return loc;
  }

  app.get(
    '/admin/narrations/coverage',
    ...editor,
    asyncHandler(async (_req, res) => {
      const rows = await query<{ location_id: number; lang: string; status: string; has_audio: boolean }>(
        `SELECT n.location_id, g.code AS lang, n.status, CAST(CASE WHEN n.audio_url IS NULL THEN 0 ELSE 1 END AS BIT) AS has_audio
         FROM dbo.Narrations n JOIN dbo.Languages g ON g.id = n.language_id`,
      );
      res.json({ items: rows.map((r) => ({ locationId: r.location_id, lang: r.lang, status: r.status, hasAudio: r.has_audio })) });
    }),
  );

  app.get(
    '/admin/locations/:id/narrations',
    ...editor,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id) || 0;
      await assertLocation(id, req.requestId);
      const rows = await query<NarrationRow>(`${NARRATION_SELECT} WHERE n.location_id = @id`, { id });
      res.json({ items: rows.map((r) => narrationDto(r)) });
    }),
  );

  app.get(
    '/admin/locations/:id/narrations/:lang',
    ...editor,
    asyncHandler(async (req, res) => {
      const lang = parse(langParam, req.params.lang);
      const [row] = await query<NarrationRow>(`${NARRATION_SELECT} WHERE n.location_id = @id AND g.code = @lang`, { id: Number(req.params.id) || 0, lang });
      if (!row) throw notFound('Chưa có bài thuyết minh cho ngôn ngữ này');
      res.json(narrationDto(row));
    }),
  );

  app.put(
    '/admin/locations/:id/narrations/:lang',
    ...editor,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id) || 0;
      const lang = parse(langParam, req.params.lang);
      const b = parse(
        z.object({
          title: z.string().trim().min(1, 'Tiêu đề là bắt buộc').max(250),
          summary: z.string().max(500).nullish(),
          content: z.string().trim().min(1, 'Nội dung là bắt buộc').max(20000),
          audioUrl: z.string().max(1000).refine((u) => u.startsWith('/media/') || /^https?:\/\//.test(u), 'URL âm thanh không hợp lệ').nullish(),
          audioDurationS: z.number().int().positive().nullish(),
          status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
        }),
        req.body,
      );
      await assertLocation(id, req.requestId);
      const [language] = await query<{ id: number }>('SELECT id FROM dbo.Languages WHERE code = @lang', { lang });
      if (!language) throw badRequest('Ngôn ngữ chưa được khai báo');
      await query(
        `MERGE dbo.Narrations AS t
         USING (SELECT @loc AS location_id, @langId AS language_id) AS s
           ON t.location_id = s.location_id AND t.language_id = s.language_id
         WHEN MATCHED THEN UPDATE SET title = @title, summary = @summary, content = @content, audio_url = @audio,
           audio_duration_s = @dur, status = @status, updated_by = @by, updated_at = SYSUTCDATETIME()
         WHEN NOT MATCHED THEN INSERT (location_id, language_id, title, summary, content, audio_url, audio_duration_s, status, updated_by)
           VALUES (@loc, @langId, @title, @summary, @content, @audio, @dur, @status, @by);`,
        {
          loc: id, langId: language.id, title: b.title, summary: b.summary ?? null, content: b.content,
          audio: b.audioUrl ?? null, dur: b.audioDurationS ?? null, status: b.status, by: req.user!.id,
        },
      );
      const [row] = await query<NarrationRow>(`${NARRATION_SELECT} WHERE n.location_id = @id AND g.code = @lang`, { id, lang });
      res.json(narrationDto(row));
    }),
  );

  // Tải lên âm thanh: MP3/M4A, tối đa 5 MB (FR-16)
  const upload = multer({
    storage: multer.diskStorage({
      destination: join(mediaDir, 'audio'),
      filename: (req, file, cb) => cb(null, `narration-${req.params.id}-${Date.now()}${extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const okExt = ['.mp3', '.m4a'].includes(extname(file.originalname).toLowerCase());
      const okType = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac'].includes(file.mimetype);
      if (okExt && okType) cb(null, true);
      else cb(badRequest('Chỉ chấp nhận file MP3 hoặc M4A'));
    },
  });

  app.post(
    '/admin/narrations/:id/audio',
    ...editor,
    (req, res, next) =>
      upload.single('audio')(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) return next(badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'File âm thanh vượt quá 5 MB' : err.message));
        next(err);
      }),
    asyncHandler(async (req, res) => {
      if (!req.file) throw badRequest('Thiếu file âm thanh (trường "audio")');
      const duration = Number(req.body?.durationSeconds) || null;
      const url = `/media/audio/${req.file.filename}`;
      const rows = await query(
        `UPDATE dbo.Narrations SET audio_url = @url, audio_duration_s = COALESCE(@dur, audio_duration_s), updated_by = @by, updated_at = SYSUTCDATETIME()
         OUTPUT INSERTED.id WHERE id = @id`,
        { id: Number(req.params.id) || 0, url, dur: duration, by: req.user!.id },
      );
      if (!rows.length) throw notFound('Không tìm thấy bài thuyết minh');
      res.json({ audioUrl: url, durationSeconds: duration });
    }),
  );

  // Ngôn ngữ (UC12) – chỉ SUPER_ADMIN
  app.get('/admin/languages', ...editor, asyncHandler(async (_req, res) => res.json({ items: await languages() })));

  app.post(
    '/admin/languages',
    ...superAdmin,
    asyncHandler(async (req, res) => {
      const b = parse(z.object({ code: langParam, name: z.string().trim().min(1).max(100), isEnabled: z.boolean().default(true), fallbackOrder: z.number().int().min(1).nullish() }), req.body);
      const dup = await query('SELECT 1 AS x FROM dbo.Languages WHERE code = @code', { code: b.code });
      if (dup.length) throw conflict('Mã ngôn ngữ đã tồn tại');
      const [row] = await query('INSERT INTO dbo.Languages (code, name, is_enabled, fallback_order) OUTPUT INSERTED.* VALUES (@code, @name, @en, @fo)', {
        code: b.code, name: b.name, en: b.isEnabled, fo: b.fallbackOrder ?? null,
      });
      res.status(201).json(row);
    }),
  );

  app.put(
    '/admin/languages/:id',
    ...superAdmin,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id) || 0;
      const b = parse(z.object({ name: z.string().trim().min(1).max(100).optional(), isEnabled: z.boolean().optional(), isDefault: z.literal(true).optional(), fallbackOrder: z.number().int().min(1).nullish() }), req.body);
      const [current] = await query<LanguageInfo>('SELECT * FROM dbo.Languages WHERE id = @id', { id });
      if (!current) throw notFound('Không tìm thấy ngôn ngữ');
      if (current.is_default && b.isEnabled === false) throw badRequest('Không thể tắt ngôn ngữ mặc định – hãy chọn ngôn ngữ mặc định khác trước');
      const tx = new sql.Transaction(await getPool());
      await tx.begin();
      try {
        if (b.isDefault) await new sql.Request(tx).query('UPDATE dbo.Languages SET is_default = 0 WHERE is_default = 1');
        await new sql.Request(tx)
          .input('id', id).input('name', b.name ?? null).input('en', b.isEnabled ?? null).input('def', b.isDefault ? 1 : null)
          .input('fo', b.fallbackOrder === undefined ? current.fallback_order : b.fallbackOrder)
          .query(`UPDATE dbo.Languages SET name = COALESCE(@name, name), is_enabled = CASE WHEN @def = 1 THEN 1 ELSE COALESCE(@en, is_enabled) END,
                  is_default = COALESCE(@def, is_default), fallback_order = @fo WHERE id = @id`);
        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      }
      const [row] = await query('SELECT * FROM dbo.Languages WHERE id = @id', { id });
      res.json(row);
    }),
  );

  // Bản dịch giao diện (UiTranslations)
  app.get(
    '/admin/ui-translations/:lang',
    ...editor,
    asyncHandler(async (req, res) => {
      const lang = parse(langParam, req.params.lang);
      const rows = await query<{ key: string; value: string }>(
        'SELECT t.[key], t.value FROM dbo.UiTranslations t JOIN dbo.Languages g ON g.id = t.language_id WHERE g.code = @lang', { lang },
      );
      res.json({ lang, items: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
    }),
  );

  app.put(
    '/admin/ui-translations/:lang',
    ...editor,
    asyncHandler(async (req, res) => {
      const lang = parse(langParam, req.params.lang);
      const { items } = parse(z.object({ items: z.record(z.string().regex(/^[a-zA-Z0-9_.-]{1,150}$/), z.string().max(1000)) }), req.body);
      const [language] = await query<{ id: number }>('SELECT id FROM dbo.Languages WHERE code = @lang', { lang });
      if (!language) throw notFound('Không tìm thấy ngôn ngữ');
      for (const [key, value] of Object.entries(items)) {
        await query(
          `MERGE dbo.UiTranslations AS t USING (SELECT @lid AS language_id, @k AS [key]) AS s
             ON t.language_id = s.language_id AND t.[key] = s.[key]
           WHEN MATCHED THEN UPDATE SET value = @v, updated_at = SYSUTCDATETIME()
           WHEN NOT MATCHED THEN INSERT (language_id, [key], value) VALUES (@lid, @k, @v);`,
          { lid: language.id, k: key, v: value },
        );
      }
      res.json({ lang, updated: Object.keys(items).length });
    }),
  );

  app.use((err: unknown, _req: express.Request, _res: express.Response, next: express.NextFunction) => {
    // express.static với fallthrough=false trả lỗi 404 dạng http-errors
    if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) return next(notFound('Không tìm thấy file'));
    if (err instanceof AppError) return next(err);
    next(err);
  });

  return finalize(app, logger);
}

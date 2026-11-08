import { randomUUID, timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { AppError, errorBody, unauthorized } from './errors.js';
import { getPool } from './db.js';
import type { Logger } from './logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

/** Gắn/chuyển tiếp X-Request-Id để truy vết xuyên service. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && incoming.length <= 64 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Chỉ cho phép yêu cầu có X-Internal-Key đúng (gọi từ Gateway hoặc service khác). */
export const requireInternalKey: RequestHandler = (req, _res, next) => {
  const expected = process.env.INTERNAL_API_KEY;
  const got = req.header('x-internal-key');
  if (!expected || !got || !safeEqual(expected, got)) return next(unauthorized('Sai hoặc thiếu X-Internal-Key'));
  next();
};

/** Kiểm tra dữ liệu đầu vào bằng Zod; trả về dữ liệu đã chuẩn hóa. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

export function errorHandler(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({ field: i.path.join('.') || '(body)', issue: i.message }));
      return res.status(400).json(errorBody('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', req.requestId, details));
    }
    if (err instanceof AppError) {
      return res.status(err.status).json(errorBody(err.code, err.message, req.requestId, err.details));
    }
    if (err && typeof err === 'object' && 'type' in err && (err as { type: string }).type === 'entity.parse.failed') {
      return res.status(400).json(errorBody('VALIDATION_ERROR', 'JSON không hợp lệ', req.requestId));
    }
    logger.error('Unhandled error', { requestId: req.requestId, err: err instanceof Error ? err.stack : String(err) });
    return res.status(500).json(errorBody('INTERNAL_ERROR', 'Lỗi hệ thống', req.requestId));
  };
}

/** Khung Express chung: JSON, requestId, /health (liveness), /ready (readiness – kết nối DB). */
export function createBaseApp(service: string, opts: { db?: boolean } = { db: true }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', service }));
  app.get(
    '/ready',
    asyncHandler(async (_req, res) => {
      if (opts.db) {
        try {
          await (await getPool()).request().query('SELECT 1 AS ok');
        } catch {
          return res.status(503).json({ status: 'unavailable', service, db: 'down' });
        }
      }
      res.json({ status: 'ready', service });
    }),
  );
  return app;
}

export function finalize(app: express.Express, logger: Logger) {
  app.use((req, res) => res.status(404).json(errorBody('NOT_FOUND', `Không có route ${req.method} ${req.path}`, req.requestId)));
  app.use(errorHandler(logger));
  return app;
}

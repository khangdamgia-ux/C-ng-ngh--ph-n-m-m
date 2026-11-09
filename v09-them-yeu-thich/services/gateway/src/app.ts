import type { IncomingMessage, ServerResponse } from 'node:http';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { asyncHandler, createLogger, errorBody, errorHandler, requestId } from '@hoian/shared';
import { resolveRoute, rewritePath, type ServiceName } from './routes.js';

const logger = createLogger('gateway');

export function serviceUrls(): Record<ServiceName, string> {
  return {
    location: process.env.LOCATION_SERVICE_URL ?? 'http://localhost:4002',
    content: process.env.CONTENT_SERVICE_URL ?? 'http://localhost:4003',
  };
}

declare module 'node:http' {
  interface IncomingMessage {
    routeService?: ServiceName;
    requestId?: string;
  }
}

export function createApp() {
  const urls = serviceUrls();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim());
  app.use(cors({ origin: origins, credentials: false }));
  app.use(requestId);

  // Không tin các header nội bộ do client gửi lên
  app.use((req, _res, next) => {
    delete req.headers['x-internal-key'];
    next();
  });

  app.get(['/health', '/api/health'], (_req, res) => res.json({ status: 'ok', service: 'gateway' }));
  app.get(
    ['/ready', '/api/ready'],
    asyncHandler(async (_req, res) => {
      const checks = await Promise.all(
        Object.entries(urls).map(async ([name, url]) => {
          try {
            const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
            return [name, r.ok ? 'up' : 'down'] as const;
          } catch {
            return [name, 'down'] as const;
          }
        }),
      );
      const services = Object.fromEntries(checks);
      res.status(checks.every(([, s]) => s === 'up') ? 200 : 503).json({ status: 'checked', services });
    }),
  );

  // Rate limit 120 yêu cầu/phút/IP cho API công khai (NFR-04)
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: Number(process.env.RATE_LIMIT_PER_MIN ?? 120),
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (req, res) => res.status(429).json(errorBody('RATE_LIMITED', 'Quá nhiều yêu cầu, vui lòng thử lại sau', req.requestId)),
    }),
  );

  // Định tuyến
  app.use(
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
      const route = resolveRoute(req.path);
      if (!route) return res.status(404).json(errorBody('NOT_FOUND', `Không có API ${req.method} ${req.path}`, req.requestId));
      req.routeService = route.service;
      next();
    }),
  );

  const proxy = createProxyMiddleware<IncomingMessage, ServerResponse>({
    router: (req) => urls[req.routeService as ServiceName],
    changeOrigin: true,
    pathRewrite: (path) => rewritePath(path),
    proxyTimeout: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 5000),
    timeout: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 5000),
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-Internal-Key', process.env.INTERNAL_API_KEY ?? '');
        proxyReq.setHeader('X-Request-Id', (req as Request).requestId ?? '');
      },
      error: (err, req, res) => {
        const r = req as Request;
        logger.warn('Upstream lỗi', { requestId: r.requestId, service: r.routeService, err: err.message });
        const out = res as ServerResponse;
        if (!out.headersSent && 'writeHead' in out) {
          out.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          out.end(JSON.stringify(errorBody('UPSTREAM_UNAVAILABLE', `Dịch vụ ${r.routeService} tạm thời không khả dụng`, r.requestId)));
        }
      },
    },
  });
  app.use(proxy);
  app.use(errorHandler(logger));
  return app;
}

import { AppError, upstreamUnavailable } from './errors.js';

export interface CallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  requestId?: string;
  timeoutMs?: number;
  /** Số lần thử lại (chỉ áp dụng cho GET – idempotent). */
  retries?: number;
}

/**
 * Gọi API nội bộ của service khác (East–West, PRD mục 8.3):
 * gắn X-Internal-Key + X-Request-Id, timeout 2 s, retry GET 1 lần (backoff 200 ms).
 * Trả về null khi 404.
 */
export async function callService<T>(service: string, baseUrl: string, path: string, opts: CallOptions = {}): Promise<T | null> {
  const method = opts.method ?? 'GET';
  const retries = method === 'GET' ? (opts.retries ?? 1) : 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'X-Internal-Key': process.env.INTERNAL_API_KEY ?? '',
          ...(opts.requestId ? { 'X-Request-Id': opts.requestId } : {}),
          ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 2000),
      });
      if (res.status === 404) return null;
      if (res.status >= 500) throw new Error(`${service} trả về ${res.status}`);
      const data = (await res.json()) as T & { error?: { code: string; message: string } };
      if (!res.ok) throw new AppError(res.status, (data.error?.code as never) ?? 'INTERNAL_ERROR', data.error?.message ?? 'Lỗi');
      return data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (attempt === retries) throw upstreamUnavailable(service);
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw upstreamUnavailable(service);
}

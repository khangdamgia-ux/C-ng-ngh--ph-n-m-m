import type { ApiErrorBody } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { field: string; issue: string }[],
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
/** Thông báo khi máy chủ/proxy trả lỗi không phải JSON (vd. trang HTML 502; HTTP/2 không có statusText). */
const fallbackMessage = (status: number, statusText: string) =>
  status === 429 ? 'Quá nhiều yêu cầu, vui lòng thử lại sau'
  : status >= 500 ? 'Máy chủ tạm thời không khả dụng, vui lòng thử lại sau'
  : statusText || `Lỗi ${status}`;

type Options = Omit<RequestInit, 'body'> & { body?: unknown; raw?: boolean };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...opts, headers, body });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ');
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, data?.error?.code ?? 'HTTP_' + res.status, data?.error?.message || fallbackMessage(res.status, res.statusText), data?.error?.details, data?.error?.requestId);
  }
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  field: string;
  issue: string;
}

/** Lỗi nghiệp vụ có mã HTTP và mã lỗi chuẩn (PRD mục 8.3.4). */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: ErrorDetail[]) => new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Thiếu hoặc sai thông tin xác thực') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Không đủ quyền thực hiện thao tác') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Không tìm thấy tài nguyên') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
export const upstreamUnavailable = (service: string) =>
  new AppError(503, 'UPSTREAM_UNAVAILABLE', `Dịch vụ ${service} tạm thời không khả dụng`);

export function errorBody(code: ErrorCode, message: string, requestId?: string, details?: ErrorDetail[]) {
  return { error: { code, message, ...(details ? { details } : {}), ...(requestId ? { requestId } : {}) } };
}

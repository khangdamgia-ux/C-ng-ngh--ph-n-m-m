export type ServiceName = 'location' | 'content';

export interface RouteMatch {
  service: ServiceName;
}

/**
 * Bảng định tuyến API Gateway (PRD mục 8.3.2). Thứ tự quan trọng: route cụ thể đặt trước.
 * Đường dẫn /internal/* KHÔNG bao giờ được định tuyến ra ngoài.
 */
const TABLE: Array<[RegExp, ServiceName]> = [
  [/^\/api\/v1\/locations\/[^/]+\/narration$/, 'content'],
  [/^\/api\/v1\/(locations|categories)(\/|$)/, 'location'],
  [/^\/api\/v1\/languages(\/|$)/, 'content'],
];

export function resolveRoute(path: string): RouteMatch | null {
  if (path.includes('/internal/') || path.includes('..')) return null;
  for (const [re, service] of TABLE) if (re.test(path)) return { service };
  return null;
}

/** /api/v1/locations?lang=ko → /locations?lang=ko (service nhận đường dẫn không có tiền tố). */
export const rewritePath = (path: string) => path.replace(/^\/api\/v1/, '');

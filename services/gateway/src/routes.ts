export type ServiceName = 'auth' | 'location' | 'content' | 'analytics';

export interface RouteMatch {
  service: ServiceName;
  /** Cần JWT hợp lệ */
  auth: boolean;
}

/**
 * Bảng định tuyến API Gateway (PRD mục 8.3.2). Thứ tự quan trọng: route cụ thể đặt trước.
 * Đường dẫn /internal/* KHÔNG bao giờ được định tuyến ra ngoài.
 */
const TABLE: Array<[RegExp, ServiceName, boolean]> = [
  [/^\/api\/v1\/auth\/me$/, 'auth', true],
  [/^\/api\/v1\/auth\//, 'auth', false],
  [/^\/api\/v1\/locations\/[^/]+\/narration$/, 'content', false],
  [/^\/api\/v1\/(locations|categories)(\/|$)/, 'location', false],
  [/^\/api\/v1\/(languages|ui-translations)(\/|$)/, 'content', false],
  [/^\/api\/v1\/analytics\//, 'analytics', false],
  [/^\/api\/v1\/admin\/locations\/\d+\/narrations(\/|$)/, 'content', true],
  [/^\/api\/v1\/admin\/(narrations|languages|ui-translations)(\/|$)/, 'content', true],
  [/^\/api\/v1\/admin\/(locations|categories)(\/|$)/, 'location', true],
  [/^\/api\/v1\/admin\/stats\//, 'analytics', true],
  [/^\/api\/v1\/admin\/accounts(\/|$)/, 'auth', true],
  [/^\/media\//, 'content', false],
];

export function resolveRoute(path: string): RouteMatch | null {
  if (path.includes('/internal/') || path.includes('..')) return null;
  for (const [re, service, auth] of TABLE) if (re.test(path)) return { service, auth };
  return null;
}

/** /api/v1/locations?lang=ko → /locations?lang=ko (service nhận đường dẫn không có tiền tố). */
export const rewritePath = (path: string) => path.replace(/^\/api\/v1/, '');

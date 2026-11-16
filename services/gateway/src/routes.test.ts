import { describe, expect, it } from 'vitest';
import { resolveRoute, rewritePath } from './routes.js';

describe('resolveRoute', () => {
  it.each([
    ['/api/v1/locations', 'location', false],
    ['/api/v1/locations/chua-cau', 'location', false],
    ['/api/v1/locations/chua-cau/narration', 'content', false],
    ['/api/v1/categories', 'location', false],
    ['/api/v1/languages', 'content', false],
    ['/api/v1/analytics/sessions/abc/heartbeat', 'analytics', false],
    ['/api/v1/auth/login', 'auth', false],
    ['/api/v1/auth/me', 'auth', true],
    ['/api/v1/admin/locations/3/narrations/ko', 'content', true],
    ['/api/v1/admin/locations/3/qr', 'location', true],
    ['/api/v1/admin/stats/visits', 'analytics', true],
    ['/api/v1/admin/accounts', 'auth', true],
    ['/media/audio/a.mp3', 'content', false],
  ])('%s → %s', (path, service, auth) => {
    expect(resolveRoute(path)).toEqual({ service, auth });
  });

  it('chặn /internal và route lạ', () => {
    expect(resolveRoute('/api/v1/internal/locations/x/status')).toBeNull();
    expect(resolveRoute('/internal/auth/verify')).toBeNull();
    expect(resolveRoute('/api/v1/unknown')).toBeNull();
  });

  it('bỏ tiền tố /api/v1', () => expect(rewritePath('/api/v1/locations?lang=ko')).toBe('/locations?lang=ko'));
});

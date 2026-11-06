import { describe, expect, it } from 'vitest';
import { resolveRoute, rewritePath } from './routes.js';

describe('resolveRoute', () => {
  it.each([
    ['/api/v1/locations', 'location'],
    ['/api/v1/locations/chua-cau', 'location'],
    ['/api/v1/locations/chua-cau/narration', 'content'],
  ])('%s → %s', (path, service) => {
    expect(resolveRoute(path)).toEqual({ service });
  });

  it('chặn /internal và route lạ', () => {
    expect(resolveRoute('/api/v1/internal/locations/x/status')).toBeNull();
    expect(resolveRoute('/internal/locations/x/status')).toBeNull();
    expect(resolveRoute('/api/v1/unknown')).toBeNull();
    expect(resolveRoute('/api/v1/admin/locations')).toBeNull();
  });

  it('bỏ tiền tố /api/v1', () => expect(rewritePath('/api/v1/locations?lang=ko')).toBe('/locations?lang=ko'));
});

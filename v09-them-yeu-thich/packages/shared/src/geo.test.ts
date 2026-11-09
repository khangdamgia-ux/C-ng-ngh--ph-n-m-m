import { describe, expect, it } from 'vitest';
import { haversine } from './geo.js';

describe('haversine', () => {
  it('trả về 0 khi hai điểm trùng nhau', () => {
    expect(haversine({ lat: 15.87709, lng: 108.32602 }, { lat: 15.87709, lng: 108.32602 })).toBe(0);
  });

  it('tính đúng khoảng cách Chùa Cầu – Nhà cổ Phùng Hưng (~50 m)', () => {
    const d = haversine({ lat: 15.87709, lng: 108.32602 }, { lat: 15.87717, lng: 108.32555 });
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(57);
  });

  it('1 độ vĩ ≈ 111 km', () => {
    expect(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });
});

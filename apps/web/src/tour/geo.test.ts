import { describe, expect, it } from 'vitest';
import { formatDistance, haversine, offset } from './geo';

const CHUA_CAU = { lat: 15.87709, lng: 108.32602 };

describe('haversine (web)', () => {
  it('bằng 0 với hai điểm trùng nhau', () => {
    expect(haversine(CHUA_CAU, CHUA_CAU)).toBe(0);
  });

  it('đối xứng: A→B bằng B→A', () => {
    const b = { lat: 15.8801, lng: 108.3355 };
    expect(haversine(CHUA_CAU, b)).toBeCloseTo(haversine(b, CHUA_CAU), 6);
  });

  it('một độ vĩ ≈ 111 km', () => {
    expect(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });
});

describe('offset', () => {
  it.each([
    [100, 0],
    [0, 100],
    [-50, 30],
  ])('dịch %i m bắc, %i m đông rồi đo lại bằng haversine', (north, east) => {
    const p = offset(CHUA_CAU, north, east);
    expect(haversine(CHUA_CAU, p)).toBeCloseTo(Math.hypot(north, east), 0);
  });

  it('dịch 0 m giữ nguyên điểm', () => {
    expect(offset(CHUA_CAU, 0, 0)).toEqual(CHUA_CAU);
  });
});

describe('formatDistance', () => {
  it('dưới 1 km hiển thị mét, làm tròn', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(42.4)).toBe('42 m');
    expect(formatDistance(999.4)).toBe('999 m');
  });

  it('từ 1 km hiển thị km, một chữ số thập phân, dấu phẩy', () => {
    expect(formatDistance(1000)).toBe('1,0 km');
    expect(formatDistance(2345)).toBe('2,3 km');
  });
});

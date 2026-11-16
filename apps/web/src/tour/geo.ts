export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Khoảng cách Haversine (mét) – tính hoàn toàn trên trình duyệt, tọa độ không gửi lên máy chủ (NFR-09). */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Dịch một điểm theo hướng bắc/đông (mét). */
export function offset(p: LatLng, northM: number, eastM: number): LatLng {
  return {
    lat: p.lat + (northM / R) * (180 / Math.PI),
    lng: p.lng + ((eastM / R) * (180 / Math.PI)) / Math.cos(toRad(p.lat)),
  };
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

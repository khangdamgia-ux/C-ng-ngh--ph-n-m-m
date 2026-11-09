import type { Fix } from './engine';

export type GpsFix = Fix & { heading: number | null };
export type FixListener = (fix: GpsFix) => void;
export type ErrorListener = (code: 'denied' | 'unavailable' | 'timeout' | 'unsupported') => void;

/** Nguồn vị trí (Strategy pattern): bộ máy geofence không phụ thuộc nguồn. */
export interface LocationProvider {
  readonly kind: 'gps';
  start(onFix: FixListener, onError: ErrorListener): void;
  stop(): void;
}

/** Định vị GPS thật của thiết bị (Geolocation API – watchPosition). Tọa độ chỉ xử lý trên máy, không gửi lên máy chủ. */
export class BrowserGpsProvider implements LocationProvider {
  readonly kind = 'gps' as const;
  private watchId: number | null = null;

  start(onFix: FixListener, onError: ErrorListener) {
    if (!('geolocation' in navigator)) return onError('unsupported');
    this.watchId = navigator.geolocation.watchPosition(
      (p) =>
        onFix({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          heading: p.coords.heading !== null && Number.isFinite(p.coords.heading) ? p.coords.heading : null,
          timestamp: p.timestamp || Date.now(),
        }),
      (err) => onError(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15_000 },
    );
  }

  stop() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }
}

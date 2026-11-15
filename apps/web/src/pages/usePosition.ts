import { useEffect, useState } from 'react';
import { useTour } from '../tour/TourContext';
import type { LatLng } from '../tour/geo';

/** Vị trí để sắp xếp “Gần tôi” (FR-09): ưu tiên vị trí đang tham quan, nếu không thì hỏi một lần khi người dùng bật. */
export function useUserPosition(enabled: boolean) {
  const { position } = useTour();
  const [once, setOnce] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || position || once) return;
    if (!('geolocation' in navigator)) return setError('unsupported');
    navigator.geolocation.getCurrentPosition(
      (p) => setOnce({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => setError(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, [enabled, position, once]);
  return { position: position ?? once, error };
}

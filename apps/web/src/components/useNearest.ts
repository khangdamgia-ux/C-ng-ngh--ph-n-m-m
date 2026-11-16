import { useMemo } from 'react';
import type { LocationItem } from '../api/types';
import { haversine, type LatLng } from '../tour/geo';

/** Di tích gần vị trí người dùng nhất (tính trên thiết bị). */
export function useNearest(places: LocationItem[], position: LatLng | null) {
  return useMemo(() => {
    if (!position) return null;
    let best: { place: LocationItem; distance: number } | null = null;
    for (const p of places) {
      if (p.latitude === null || p.longitude === null) continue;
      const d = haversine(position, { lat: p.latitude, lng: p.longitude });
      if (!best || d < best.distance) best = { place: p, distance: d };
    }
    return best;
  }, [places, position]);
}

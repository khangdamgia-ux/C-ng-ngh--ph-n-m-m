import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { LocationItem, Narration, Paged } from './types';

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: () => api<Paged<LocationItem>>('/locations?pageSize=100'),
    staleTime: 5 * 60_000,
  });
}

export function useLocation(code: string | undefined) {
  return useQuery({
    queryKey: ['location', code],
    queryFn: () => api<LocationItem>(`/locations/${code}`),
    enabled: !!code,
    retry: (n, err) => (err as { status?: number }).status !== 404 && n < 2,
  });
}

export function useNarration(code: string | undefined) {
  return useQuery({
    queryKey: ['narration', code],
    queryFn: () => api<Narration>(`/locations/${code}/narration`),
    enabled: !!code,
    retry: (n, err) => (err as { status?: number }).status !== 404 && n < 2,
  });
}

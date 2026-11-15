import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { Category, Language, LocationItem, Narration, Paged } from './types';

export function useLocations(lang: string, params: { q?: string; category?: string } = {}) {
  const qs = new URLSearchParams({ lang, pageSize: '100' });
  if (params.q) qs.set('q', params.q);
  if (params.category) qs.set('category', params.category);
  return useQuery({
    queryKey: ['locations', lang, params.q ?? '', params.category ?? ''],
    queryFn: () => api<Paged<LocationItem>>(`/locations?${qs}`),
    staleTime: 5 * 60_000,
  });
}

export function useLocation(code: string | undefined, lang: string) {
  return useQuery({
    queryKey: ['location', code, lang],
    queryFn: () => api<LocationItem>(`/locations/${code}?lang=${lang}`),
    enabled: !!code,
    retry: (n, err) => (err as { status?: number }).status !== 404 && n < 2,
  });
}

export function useNarration(code: string | undefined, lang: string) {
  return useQuery({
    queryKey: ['narration', code, lang],
    queryFn: () => api<Narration>(`/locations/${code}/narration?lang=${lang}`),
    enabled: !!code,
    retry: (n, err) => (err as { status?: number }).status !== 404 && n < 2,
  });
}

export const fetchNarration = (code: string, lang: string) => api<Narration>(`/locations/${code}/narration?lang=${lang}`);

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => api<{ items: Category[] }>('/categories'), staleTime: 60 * 60_000 });
}

export function useLanguages() {
  return useQuery({ queryKey: ['languages'], queryFn: () => api<{ items: Language[] }>('/languages'), staleTime: 60_000, refetchOnWindowFocus: true });
}

import { useQuery } from '@tanstack/react-query';
import { LANG_NAMES, SUPPORTED } from '../i18n';
import { adminApi } from './auth';

export interface AdminLanguage { id: number; code: string; name: string; is_default: boolean; is_enabled: boolean; fallback_order: number | null }

/** Danh sách ngôn ngữ thật trong CSDL (kể cả đang tắt) – dùng cho cột độ phủ và tab soạn thuyết minh. */
export function useAdminLanguages() {
  const q = useQuery({ queryKey: ['admin-languages'], queryFn: () => adminApi<{ items: AdminLanguage[] }>('/languages') });
  const items = q.data?.items ?? [];
  for (const l of items) LANG_NAMES[l.code] = l.name;
  const codes = items.length ? items.map((l) => l.code) : [...SUPPORTED];
  return { ...q, items, codes };
}

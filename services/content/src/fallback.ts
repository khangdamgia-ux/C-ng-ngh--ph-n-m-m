export interface LanguageInfo {
  id: number;
  code: string;
  is_default: boolean;
  is_enabled: boolean;
  fallback_order: number | null;
}

/**
 * Chuỗi ngôn ngữ dự phòng (FR-03): ngôn ngữ yêu cầu → các ngôn ngữ có fallback_order (tăng dần, mặc định EN → VI)
 * → ngôn ngữ mặc định. Chỉ gồm ngôn ngữ đang bật, không trùng lặp.
 */
export function fallbackChain(requested: string | undefined, languages: LanguageInfo[]): string[] {
  const enabled = languages.filter((l) => l.is_enabled);
  const chain: string[] = [];
  const push = (code?: string) => {
    if (code && !chain.includes(code) && enabled.some((l) => l.code === code)) chain.push(code);
  };
  push(requested?.toLowerCase());
  enabled
    .filter((l) => l.fallback_order !== null)
    .sort((a, b) => (a.fallback_order ?? 0) - (b.fallback_order ?? 0))
    .forEach((l) => push(l.code));
  push(enabled.find((l) => l.is_default)?.code);
  return chain;
}

/** Chọn bản dịch tốt nhất theo chuỗi dự phòng. */
export function pickByChain<T extends { lang: string }>(items: T[], chain: string[]): T | undefined {
  for (const code of chain) {
    const hit = items.find((i) => i.lang === code);
    if (hit) return hit;
  }
  return undefined;
}

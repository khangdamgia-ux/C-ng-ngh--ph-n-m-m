import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './locales/vi';
import en from './locales/en';
import fr from './locales/fr';
import ko from './locales/ko';
import zh from './locales/zh';
import ja from './locales/ja';
import { local } from '../storage';

export const SUPPORTED = ['vi', 'en', 'ko', 'zh', 'ja', 'fr'] as const;
export const LANG_NAMES: Record<string, string> = { vi: 'Tiếng Việt', en: 'English', ko: '한국어', zh: '中文', ja: '日本語', fr: 'Français' };
const KEY = 'hoian.lang';
export const LANG_CODE = /^[a-z]{2}(-[A-Za-z]{2,4})?$/;

/** FR-02: ngôn ngữ đã lưu → ngôn ngữ thiết bị (navigator.language) → Tiếng Việt. */
export function initialLanguage(): string {
  // ?lang=xx trên địa chỉ (vd. nút "Xem web" trong Admin) – ngôn ngữ có bật hay không sẽ được LanguageSync kiểm tra lại.
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl && LANG_CODE.test(fromUrl)) return fromUrl;
  const saved = local.read<string>(KEY, '');
  if (saved && LANG_CODE.test(saved)) return saved;
  const device = (navigator.language || 'vi').slice(0, 2).toLowerCase();
  return (SUPPORTED as readonly string[]).includes(device) ? device : 'vi';
}

export function saveLanguage(lang: string) {
  local.write(KEY, lang);
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries({ vi, en, fr, ko, zh, ja }).map(([k, v]) => [k, { translation: v }])),
  lng: initialLanguage(),
  fallbackLng: ['en', 'vi'],
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  saveLanguage(lng);
});

export default i18n;

/** Ngôn ngữ do Admin bật trên máy chủ: cập nhật tên hiển thị để mọi nơi (vd. thông báo dự phòng) dùng đúng tên. */
export function applyServerLanguages(items: Array<{ code: string; name: string }>) {
  for (const l of items) LANG_NAMES[l.code] = l.name;
}

const loadedUi = new Set<string>();
/**
 * Bản dịch giao diện nhập trong Admin (bảng UiTranslations) – ghi đè lên bản dựng sẵn.
 * Ngôn ngữ mới (vd. de) chưa có bản dựng sẵn: khóa nào chưa dịch sẽ dùng tiếng Anh, rồi tiếng Việt.
 */
export async function loadUiTranslations(lang: string, base = import.meta.env.VITE_API_BASE_URL ?? '/api/v1') {
  if (loadedUi.has(lang)) return;
  loadedUi.add(lang);
  try {
    const res = await fetch(`${base}/ui-translations?lang=${encodeURIComponent(lang)}`);
    if (!res.ok) return;
    const { items } = (await res.json()) as { items: Record<string, string> };
    if (items && Object.keys(items).length) {
      i18n.addResourceBundle(lang, 'translation', items, true, true);
      if (i18n.language === lang) void i18n.changeLanguage(lang);
    }
  } catch {
    loadedUi.delete(lang);
  }
}

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguages } from '../api/hooks';
import { applyServerLanguages, LANG_NAMES, SUPPORTED } from '../i18n';

/**
 * Chọn ngôn ngữ – danh sách lấy từ máy chủ (chỉ ngôn ngữ đang bật, đúng tên hiển thị).
 * Nếu ngôn ngữ đang dùng không còn bật → tự chuyển về ngôn ngữ mặc định.
 * Mất mạng / API lỗi → dùng 6 ngôn ngữ dựng sẵn.
 */
export function LangSelect() {
  const { i18n, t } = useTranslation();
  const { data } = useLanguages();
  const server = data?.items;
  const options = server?.length ? server.map((l) => ({ code: l.code, name: l.name })) : SUPPORTED.map((c) => ({ code: c, name: LANG_NAMES[c] }));

  useEffect(() => {
    if (!server?.length) return;
    applyServerLanguages(server);
    if (!server.some((l) => l.code === i18n.language)) {
      const fallback = server.find((l) => l.isDefault)?.code ?? server[0].code;
      void i18n.changeLanguage(fallback);
    }
  }, [server, i18n]);

  return (
    <label>
      <span className="sr-only">{t('lang.label')}</span>
      <select
        className="lang-select"
        value={options.some((o) => o.code === i18n.language) ? i18n.language : options[0]?.code}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        aria-label={t('lang.label')}
      >
        {options.map((l) => (
          <option key={l.code} value={l.code}>{l.name}</option>
        ))}
      </select>
    </label>
  );
}

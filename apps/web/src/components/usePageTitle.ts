import { useEffect } from 'react';

const USER_SUFFIX = 'Hội An Audio Guide';
const ADMIN_SUFFIX = 'HoiAn Guide';

/**
 * Đặt tiêu đề tab + biểu tượng tab để phân biệt rõ hai khu vực:
 *  - Web người dùng: "Địa điểm – Hội An Audio Guide" (icon đèn lồng nền đỏ)
 *  - Quản trị:       "[Admin] Dashboard – HoiAn Guide" (icon nền tối riêng)
 * Truyền `null` để bỏ qua (trang con tự đặt tiêu đề của mình).
 */
export function usePageTitle(page: string | null | undefined, area: 'user' | 'admin') {
  useEffect(() => {
    if (page === null) return;
    document.title = area === 'admin'
      ? `[Admin] ${page ? `${page} – ` : ''}${ADMIN_SUFFIX}`
      : page ? `${page} – ${USER_SUFFIX}` : USER_SUFFIX;
    document.body.dataset.area = area;
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const href = area === 'admin' ? '/favicon-admin.svg' : '/favicon.svg';
    if (icon && !icon.href.endsWith(href)) icon.href = href;
  }, [page, area]);
}

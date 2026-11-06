import { useEffect } from 'react';

const SUFFIX = 'Hội An Audio Guide';

/**
 * Đặt tiêu đề tab: "Địa điểm – Hội An Audio Guide".
 * Truyền `null` để bỏ qua (trang con tự đặt tiêu đề của mình).
 */
export function usePageTitle(page: string | null | undefined) {
  useEffect(() => {
    if (page === null) return;
    document.title = page ? `${page} – ${SUFFIX}` : SUFFIX;
  }, [page]);
}

import { useEffect, useState } from 'react';

/** Render lại khi yêu thích/lịch sử thay đổi. */
export function useStorageVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const on = () => setV((x) => x + 1);
    window.addEventListener('hoian:storage', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('hoian:storage', on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return v;
}

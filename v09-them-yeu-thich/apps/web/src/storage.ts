/** localStorage/sessionStorage an toàn (chế độ riêng tư có thể ném lỗi). */
function read<T>(store: 'local' | 'session', key: string, fallback: T): T {
  try {
    const raw = (store === 'local' ? localStorage : sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(store: 'local' | 'session', key: string, value: unknown) {
  try {
    (store === 'local' ? localStorage : sessionStorage).setItem(key, JSON.stringify(value));
  } catch {
    /* bỏ qua */
  }
}

const FAV = 'hoian.favorites';

export const favorites = {
  list: () => read<string[]>('local', FAV, []),
  has: (code: string) => favorites.list().includes(code),
  toggle(code: string) {
    const list = favorites.list();
    const next = list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
    write('local', FAV, next);
    window.dispatchEvent(new Event('hoian:storage'));
    return next.includes(code);
  },
};

export const session = { read: <T,>(k: string, f: T) => read('session', k, f), write: (k: string, v: unknown) => write('session', k, v) };
export const local = { read: <T,>(k: string, f: T) => read('local', k, f), write: (k: string, v: unknown) => write('local', k, v) };

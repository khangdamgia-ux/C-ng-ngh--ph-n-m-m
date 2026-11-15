import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { favorites, history, local, session } from './storage';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

let dispatched: string[];

beforeEach(() => {
  dispatched = [];
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubGlobal('window', { dispatchEvent: (e: Event) => dispatched.push(e.type) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('favorites', () => {
  it('rỗng khi chưa lưu gì', () => {
    expect(favorites.list()).toEqual([]);
    expect(favorites.has('chua-cau')).toBe(false);
  });

  it('toggle thêm rồi bỏ một địa điểm và phát sự kiện hoian:storage', () => {
    expect(favorites.toggle('chua-cau')).toBe(true);
    expect(favorites.has('chua-cau')).toBe(true);
    expect(favorites.toggle('chua-cau')).toBe(false);
    expect(favorites.list()).toEqual([]);
    expect(dispatched).toEqual(['hoian:storage', 'hoian:storage']);
  });

  it('giữ thứ tự thêm vào', () => {
    favorites.toggle('a');
    favorites.toggle('b');
    expect(favorites.list()).toEqual(['a', 'b']);
  });
});

describe('history', () => {
  it('địa điểm mới nhất đứng đầu và không trùng lặp', () => {
    history.add('a', 'A');
    history.add('b', 'B');
    history.add('a', 'A');
    expect(history.list().map((h) => h.code)).toEqual(['a', 'b']);
  });

  it('giữ tối đa 50 mục', () => {
    for (let i = 0; i < 60; i++) history.add(`p${i}`, `P${i}`);
    const list = history.list();
    expect(list).toHaveLength(50);
    expect(list[0].code).toBe('p59');
  });

  it('clear xoá toàn bộ lịch sử', () => {
    history.add('a', 'A');
    history.clear();
    expect(history.list()).toEqual([]);
  });
});

describe('local/session', () => {
  it('đọc lại đúng giá trị đã ghi', () => {
    local.write('k', { x: 1 });
    session.write('k', [1, 2]);
    expect(local.read('k', null)).toEqual({ x: 1 });
    expect(session.read('k', null)).toEqual([1, 2]);
  });

  it('trả giá trị mặc định khi dữ liệu hỏng', () => {
    localStorage.setItem('hong', '{khong-phai-json');
    expect(local.read('hong', 'mac-dinh')).toBe('mac-dinh');
  });

  it('không ném lỗi khi trình duyệt chặn bộ nhớ (chế độ riêng tư)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => local.write('k', 1)).not.toThrow();
    expect(local.read('k', 7)).toBe(7);
    expect(favorites.list()).toEqual([]);
  });
});

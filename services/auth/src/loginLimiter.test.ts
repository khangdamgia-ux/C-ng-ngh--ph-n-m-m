import { describe, expect, it } from 'vitest';
import { LoginLimiter } from './loginLimiter.js';

describe('LoginLimiter', () => {
  it('khóa sau 5 lần sai và mở lại sau 15 phút', () => {
    let t = 0;
    const l = new LoginLimiter(5, 15 * 60_000, () => t);
    for (let i = 0; i < 5; i++) l.recordFailure('1.1.1.1', 'admin');
    expect(l.isLocked('1.1.1.1', 'admin')).toBe(true);
    expect(l.isLocked('2.2.2.2', 'admin')).toBe(false);
    t += 15 * 60_000 + 1;
    expect(l.isLocked('1.1.1.1', 'admin')).toBe(false);
  });

  it('đăng nhập thành công thì xóa bộ đếm', () => {
    const l = new LoginLimiter();
    for (let i = 0; i < 4; i++) l.recordFailure('ip', 'Admin');
    l.reset('ip', 'admin');
    l.recordFailure('ip', 'admin');
    expect(l.isLocked('ip', 'admin')).toBe(false);
  });
});

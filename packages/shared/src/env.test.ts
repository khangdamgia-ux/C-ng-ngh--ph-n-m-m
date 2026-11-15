import { afterEach, describe, expect, it } from 'vitest';
import { env, envInt } from './env.js';

const KEY = 'HOIAN_TEST_ENV_VAR';

afterEach(() => {
  delete process.env[KEY];
});

describe('env', () => {
  it('đọc giá trị từ process.env', () => {
    process.env[KEY] = 'abc';
    expect(env(KEY)).toBe('abc');
  });

  it('dùng giá trị mặc định khi biến chưa đặt', () => {
    expect(env(KEY, 'mac-dinh')).toBe('mac-dinh');
  });

  it('ưu tiên process.env hơn giá trị mặc định', () => {
    process.env[KEY] = 'that';
    expect(env(KEY, 'mac-dinh')).toBe('that');
  });

  it('báo lỗi nêu tên biến khi thiếu và không có mặc định', () => {
    expect(() => env(KEY)).toThrow(KEY);
  });

  it('coi chuỗi rỗng là thiếu', () => {
    process.env[KEY] = '';
    expect(() => env(KEY)).toThrow(KEY);
  });
});

describe('envInt', () => {
  it('chuyển chuỗi số thành số nguyên', () => {
    process.env[KEY] = '8080';
    expect(envInt(KEY, 1)).toBe(8080);
  });

  it('dùng giá trị mặc định khi biến chưa đặt', () => {
    expect(envInt(KEY, 1433)).toBe(1433);
  });
});

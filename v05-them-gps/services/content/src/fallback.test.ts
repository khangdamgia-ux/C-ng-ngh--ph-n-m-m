import { describe, expect, it } from 'vitest';
import { fallbackChain, pickByChain, type LanguageInfo } from './fallback.js';

const langs: LanguageInfo[] = [
  { id: 1, code: 'vi', is_default: true, is_enabled: true, fallback_order: 2 },
  { id: 2, code: 'en', is_default: false, is_enabled: true, fallback_order: 1 },
  { id: 3, code: 'ko', is_default: false, is_enabled: true, fallback_order: null },
  { id: 4, code: 'de', is_default: false, is_enabled: false, fallback_order: null },
];

describe('fallbackChain', () => {
  it('ko → en → vi', () => expect(fallbackChain('ko', langs)).toEqual(['ko', 'en', 'vi']));
  it('không lặp khi yêu cầu chính là ngôn ngữ dự phòng', () => expect(fallbackChain('en', langs)).toEqual(['en', 'vi']));
  it('bỏ qua ngôn ngữ đang tắt hoặc không tồn tại', () => {
    expect(fallbackChain('de', langs)).toEqual(['en', 'vi']);
    expect(fallbackChain('xx', langs)).toEqual(['en', 'vi']);
  });
  it('không truyền ngôn ngữ → dùng chuỗi dự phòng', () => expect(fallbackChain(undefined, langs)).toEqual(['en', 'vi']));
});

describe('pickByChain', () => {
  it('lấy bản EN khi chưa có bản KO (TC29)', () => {
    const items = [{ lang: 'vi', t: 'Chùa Cầu' }, { lang: 'en', t: 'Japanese Bridge' }];
    expect(pickByChain(items, ['ko', 'en', 'vi'])?.t).toBe('Japanese Bridge');
  });
});

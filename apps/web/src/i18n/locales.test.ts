import { describe, expect, it } from 'vitest';
import vi from './locales/vi';
import en from './locales/en';
import fr from './locales/fr';
import ko from './locales/ko';
import zh from './locales/zh';
import ja from './locales/ja';

const LOCALES: Record<string, Record<string, string>> = { en, fr, ko, zh, ja };
const placeholders = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).map((p) => p.replace(/\s/g, '')).sort();

describe('bản dịch giao diện', () => {
  it.each(Object.keys(LOCALES))('%s có đủ khóa như tiếng Việt, không thừa khóa', (lang) => {
    expect(Object.keys(LOCALES[lang]).sort()).toEqual(Object.keys(vi).sort());
  });

  it.each(['vi', ...Object.keys(LOCALES)])('%s không có chuỗi rỗng', (lang) => {
    const msgs = lang === 'vi' ? vi : LOCALES[lang];
    const empty = Object.entries(msgs).filter(([, v]) => v.trim() === '').map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it.each(Object.keys(LOCALES))('%s giữ đúng biến nội suy {{...}} như tiếng Việt', (lang) => {
    const wrong = Object.keys(vi).filter(
      (k) => placeholders(LOCALES[lang][k]).join() !== placeholders((vi as Record<string, string>)[k]).join(),
    );
    expect(wrong).toEqual([]);
  });
});

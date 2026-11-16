import { describe, expect, it } from 'vitest';
import { splitSentences } from './narrator';

describe('splitSentences', () => {
  it('tách theo dấu câu Việt/Anh và CJK', () => {
    expect(splitSentences('Xin chào. Đây là Chùa Cầu! Bạn thấy không?')).toEqual(['Xin chào.', 'Đây là Chùa Cầu!', 'Bạn thấy không?']);
    expect(splitSentences('欢迎来到日本廊桥。它是会安的象征。')).toEqual(['欢迎来到日本廊桥。', '它是会安的象征。']);
  });

  it('cắt câu quá dài thành nhiều đoạn ngắn', () => {
    const long = 'a, '.repeat(200) + 'b.';
    const parts = splitSentences(long, 100);
    expect(parts.every((p) => p.length <= 100)).toBe(true);
    expect(parts.join(' ').replace(/\s+/g, '')).toBe(long.replace(/\s+/g, ''));
  });
});

import { useCallback, useEffect, useMemo, useState } from 'react';

const PALETTES = [
  ['#C9531A', '#F2B544'], ['#E2502B', '#F7A23B'], ['#F07B2E', '#FFD27A'], ['#1F6B66', '#7FC1B8'], ['#8A3A16', '#F2B544'],
];

export function initials(title: string) {
  return title.replace(/[()–-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function gradientFor(code: string) {
  const i = [...code].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTES.length;
  return `linear-gradient(135deg, ${PALETTES[i][0]}, ${PALETTES[i][1]})`;
}

/**
 * Ảnh địa điểm – không bao giờ để khung trống (quan trọng trên điện thoại / mạng chậm):
 *  1. Lớp nền: ảnh minh họa /places/<code>.svg hiện ngay (thiếu svg → nền màu + chữ viết tắt).
 *  2. Lớp trên: ảnh thật – ưu tiên ảnh trong CSDL (imageUrl), rồi /places/<code>.jpg; tải xong mới hiện (mờ dần).
 *     Lỗi tải, hoặc ảnh "rỗng" (< 16 px, thường do trang gốc chặn hotlink) → thử nguồn kế tiếp.
 * Trạng thái được đặt lại khi đổi địa điểm (cùng một component được dùng lại, vd. trang chi tiết).
 */
export function Thumb({ code, title, imageUrl, className = 'thumb' }: { code: string; title: string; imageUrl?: string | null; className?: string }) {
  const sources = useMemo(() => [imageUrl, `/places/${code}.jpg`].filter(Boolean) as string[], [code, imageUrl]);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [svgOk, setSvgOk] = useState(true);

  useEffect(() => {
    setIdx(0);
    setLoaded(false);
    setSvgOk(true);
  }, [code, imageUrl]);

  const src = sources[idx];
  const next = useCallback(() => {
    setLoaded(false);
    setIdx((i) => i + 1);
  }, []);
  const check = useCallback((img: HTMLImageElement) => {
    if (img.naturalWidth < 16 || img.naturalHeight < 16) next();
    else setLoaded(true);
  }, [next]);
  // Ảnh đã có sẵn trong bộ nhớ đệm có thể tải xong trước khi React gắn onLoad → kiểm tra ngay khi gắn vào DOM.
  const photoRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) check(img);
  }, [check]);

  return (
    <div className={className} style={{ backgroundImage: gradientFor(code) }} role="img" aria-label={title}>
      {svgOk
        ? <img className="thumb-ph" src={`/places/${code}.svg`} alt="" decoding="async" onError={() => setSvgOk(false)} />
        : !loaded && <span className="thumb-initials">{initials(title)}</span>}
      {src && (
        <img
          key={src}
          ref={photoRef}
          className={`thumb-photo${loaded ? ' on' : ''}`}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={(e) => check(e.currentTarget)}
          onError={next}
        />
      )}
    </div>
  );
}

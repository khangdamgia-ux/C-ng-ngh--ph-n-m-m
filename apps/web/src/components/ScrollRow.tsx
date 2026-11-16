import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';

/**
 * Hàng cuộn ngang: kéo bằng chuột / vuốt bằng ngón tay, nút ‹ › khi dùng chuột, mép mờ báo còn nội dung ở hai bên.
 * Bấm vào mục bên trong vẫn hoạt động bình thường; chỉ khi vừa kéo thì không tính là bấm.
 */
export function ScrollRow({ children, className = 'chips', role }: { children: ReactNode; className?: string; role?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, moved: false, startX: 0, startLeft: 0 });
  const [dragging, setDragging] = useState(false);
  const [edge, setEdge] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdge((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [update, children]);

  const onMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (e.button !== 0 || !el || el.scrollWidth <= el.clientWidth) return;
    drag.current = { down: true, moved: false, startX: e.clientX, startLeft: el.scrollLeft };
    const move = (ev: MouseEvent) => {
      const d = drag.current;
      if (!d.down) return;
      const dx = ev.clientX - d.startX;
      if (!d.moved && Math.abs(dx) > 5) {
        d.moved = true;
        setDragging(true);
      }
      if (d.moved) el.scrollLeft = d.startLeft - dx;
    };
    const up = () => {
      drag.current.down = false;
      setDragging(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const by = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * Math.max(160, ref.current.clientWidth * 0.7), behavior: 'smooth' });

  return (
    <div className={`scroll-row${edge.left ? ' has-l' : ''}${edge.right ? ' has-r' : ''}${dragging ? ' dragging' : ''}`}>
      {edge.left && <button type="button" className="sr-arrow l" tabIndex={-1} aria-hidden onClick={() => by(-1)}>‹</button>}
      <div
        ref={ref}
        className={className}
        role={role}
        onScroll={update}
        onMouseDown={onMouseDown}
        // Vừa kéo xong thì nuốt cú “click” sinh ra khi nhả chuột, tránh vô tình chọn mục
        onClickCapture={(e) => {
          if (drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = false;
          }
        }}
      >
        {children}
      </div>
      {edge.right && <button type="button" className="sr-arrow r" tabIndex={-1} aria-hidden onClick={() => by(1)}>›</button>}
    </div>
  );
}

import { session } from './storage';

/**
 * Theo dõi phiên ẩn danh (FR-18): mã phiên ngẫu nhiên trong sessionStorage, heartbeat 30 s (kể cả tab nền),
 * báo kết thúc ngay khi tab bị đóng hoặc rời trang khách.
 * Lỗi gửi thống kê KHÔNG ảnh hưởng chức năng chính (NFR-10). Không gửi tọa độ (NFR-09).
 */
export type EventType = 'QR_SCAN' | 'TOUR_START' | 'LOCATION_VIEW' | 'AUDIO_PLAY' | 'AUDIO_COMPLETE' | 'GEOFENCE_TRIGGER' | 'LANGUAGE_CHANGE';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
let sessionId = '';
let lang: string | null = null;

/** Ngôn ngữ hiện tại gửi kèm heartbeat/sự kiện để thống kê “Ngôn ngữ người dùng” luôn đủ thông tin. */
export function setAnalyticsLang(l: string) {
  lang = l;
}
const simulated = false;
let timer: ReturnType<typeof setInterval> | undefined;
/** Phiên đã được máy chủ tạo xong chưa – sự kiện phải đợi, nếu không 2 yêu cầu cùng tạo phiên sẽ tranh nhau và làm MẤT sự kiện. */
let sessionReady: Promise<unknown> = Promise.resolve();

/** Gửi POST; lỗi mạng/5xx/429 thì thử lại 2 lần (điện thoại hay chập chờn) – KHÔNG ném lỗi (NFR-10). */
async function post(path: string, body?: unknown, retries = 0): Promise<boolean> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        keepalive: true,
      });
      if (res.ok) return true;
      if (res.status < 500 && res.status !== 429) return false; // lỗi dữ liệu → thử lại cũng vô ích
    } catch {
      /* mất mạng → thử lại */
    }
    if (i < retries) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  return false;
}

export function initAnalytics(opts: { lang: string; source: 'QR' | 'DIRECT' }) {
  sessionId = session.read<string>('hoian.sessionId', '');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    session.write('hoian.sessionId', sessionId);
  }
  lang = opts.lang;
  sessionReady = post('/analytics/sessions', { sessionId, languageCode: opts.lang, source: opts.source, isSimulated: simulated }, 2);
  // Heartbeat cả khi tab đang ở nền (khách vẫn mở trang) – trình duyệt có thể giãn nhịp nền tới ~60 giây, vẫn dưới hạn 120 giây.
  const beat = () => void post(`/analytics/sessions/${sessionId}/heartbeat`, { languageCode: lang });
  // Chỉ khi tab bị ĐÓNG hoặc rời khỏi trang khách → báo kết thúc ngay, không chờ 120 giây.
  const end = () => {
    // sendBeacon được trình duyệt đảm bảo gửi đi cả khi trang đang đóng; không có thì dùng fetch keepalive.
    const url = `${BASE}/analytics/sessions/${sessionId}/end`;
    if (!('sendBeacon' in navigator) || !navigator.sendBeacon(url)) void post(`/analytics/sessions/${sessionId}/end`);
  };
  clearInterval(timer);
  timer = setInterval(beat, 30_000);
  // Tải lại trang: tín hiệu “kết thúc” của trang cũ có thể đến sau lệnh tạo phiên → gửi thêm 1 heartbeat để chắc chắn.
  setTimeout(beat, 3000);
  // Quay lại tab sau khi điện thoại ngủ / máy tạm dừng trang → báo lại ngay.
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && beat());
  window.addEventListener('pagehide', end);
  // Quay lại bằng nút Back (trang lấy từ bộ nhớ đệm bfcache) → phiên hoạt động lại.
  window.addEventListener('pageshow', (e) => e.persisted && beat());
}

export function track(eventType: EventType, locationId?: number | null) {
  if (!sessionId) return;
  const body = { sessionId, eventType, locationId: locationId ?? null, languageCode: lang, isSimulated: simulated };
  void sessionReady.then(() => post('/analytics/events', body, 2));
}

/**
 * Ghi nhận lượt quét QR – đúng 1 lần cho mỗi phiên, dù khách vào bằng QR chung (`/?src=qr`, trang chủ)
 * hay QR riêng từng di tích (`/l/<mã>?src=qr`). Tải lại trang không bị đếm lại.
 */
export function trackQrScan(locationId?: number | null) {
  if (session.read<boolean>('hoian.qrTracked', false)) return;
  session.write('hoian.qrTracked', true);
  track('QR_SCAN', locationId);
}

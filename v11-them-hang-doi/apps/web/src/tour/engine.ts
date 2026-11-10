import { haversine, type LatLng } from './geo';

export interface Place {
  id: number;
  code: string;
  title: string;
  lat: number;
  lng: number;
  radiusM: number;
  priority: number;
}

export interface Fix extends LatLng {
  accuracy: number;
  /** ms – dùng đồng hồ của nguồn vị trí (GPS thật hoặc đồng hồ mô phỏng) */
  timestamp: number;
}

export interface EngineConfig {
  maxAccuracyM: number;
  dwellMs: number;
  cooldownMs: number;
  exitMarginM: number;
  queueMax: number;
  /** Bài trong hàng đợi bị bỏ qua nếu người dùng đã đi xa hơn N × bán kính */
  queueDistanceFactor: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  maxAccuracyM: 30,
  dwellMs: 3000,
  cooldownMs: 30 * 60_000,
  exitMarginM: 10,
  queueMax: 3,
  queueDistanceFactor: 2,
};

export type EngineEvent =
  | { type: 'weak-gps'; accuracy: number }
  | { type: 'gps-ok' }
  | { type: 'trigger'; place: Place; distance: number; action: 'play' | 'queue' };

/**
 * Bộ máy thuyết minh rảnh tay (FR-05). Thuần logic, không phụ thuộc trình duyệt → test được.
 * - Lọc mẫu có accuracy > 30 m
 * - Kích hoạt khi ở trong bán kính ≥ 3 s (dwell), thoát vùng khi ra ngoài bán kính + 10 m (hysteresis)
 * - Mỗi địa điểm chỉ kích hoạt lại sau 30 phút (cooldown)
 * - Vùng chồng lấn: priority cao hơn, rồi gần hơn
 * - Đang phát bài khác → xếp hàng (tối đa 3), không ngắt bài đang nghe
 */
export class TourEngine {
  private places: Place[] = [];
  private entered = new Map<string, number>();
  private lastTriggered = new Map<string, number>();
  private queue: Place[] = [];
  private playing: string | null = null;
  private lastFix: Fix | null = null;
  private weak = false;

  constructor(
    private readonly config: EngineConfig = DEFAULT_CONFIG,
    cooldowns: Record<string, number> = {},
  ) {
    for (const [code, t] of Object.entries(cooldowns)) this.lastTriggered.set(code, t);
  }

  /** Ngưỡng sai số GPS (m): mẫu có sai số lớn hơn bị bỏ qua. */
  get accuracyLimit() {
    return this.config.maxAccuracyM;
  }

  setPlaces(places: Place[]) {
    this.places = places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }

  get position() {
    return this.lastFix;
  }

  get queued(): readonly Place[] {
    return this.queue;
  }

  get current() {
    return this.playing;
  }

  /** Lưu cooldown (sessionStorage) để tải lại trang không phát lặp. */
  cooldowns(): Record<string, number> {
    return Object.fromEntries(this.lastTriggered);
  }

  setPlaying(code: string | null) {
    this.playing = code;
  }

  /** Đánh dấu đã phát thủ công (vd. người dùng bấm nghe trên trang chi tiết) để không tự phát lại. */
  markPlayed(code: string, now: number) {
    this.lastTriggered.set(code, now);
    this.queue = this.queue.filter((p) => p.code !== code);
  }

  onFix(fix: Fix): EngineEvent[] {
    const events: EngineEvent[] = [];
    if (fix.accuracy > this.config.maxAccuracyM) {
      if (!this.weak) events.push({ type: 'weak-gps', accuracy: fix.accuracy });
      this.weak = true;
      return events;
    }
    if (this.weak) events.push({ type: 'gps-ok' });
    this.weak = false;
    this.lastFix = fix;
    const now = fix.timestamp;

    const candidates: Array<{ place: Place; d: number }> = [];
    for (const place of this.places) {
      const d = haversine(fix, place);
      const inside = this.entered.has(place.code);
      const radius = place.radiusM;
      if (!inside && d <= radius) this.entered.set(place.code, now);
      else if (inside && d > radius + this.config.exitMarginM) this.entered.delete(place.code);

      const since = this.entered.get(place.code);
      if (since === undefined || now - since < this.config.dwellMs) continue;
      const last = this.lastTriggered.get(place.code);
      if (last !== undefined && now - last < this.config.cooldownMs) continue;
      if (this.playing === place.code || this.queue.some((q) => q.code === place.code)) continue;
      candidates.push({ place, d });
    }

    // Vùng chồng lấn: ưu tiên cao hơn trước, rồi gần hơn (PRD)
    candidates.sort((a, b) => b.place.priority - a.place.priority || a.d - b.d);
    const best = candidates[0];
    if (!best) return events;

    this.lastTriggered.set(best.place.code, now);
    if (this.playing) {
      if (this.queue.length >= this.config.queueMax) this.queue.shift();
      this.queue.push(best.place);
      events.push({ type: 'trigger', place: best.place, distance: best.d, action: 'queue' });
    } else {
      this.playing = best.place.code;
      events.push({ type: 'trigger', place: best.place, distance: best.d, action: 'play' });
    }
    return events;
  }

  /** Bài hiện tại kết thúc → lấy bài kế tiếp còn ở gần trong hàng đợi. */
  next(): Place | null {
    this.playing = null;
    while (this.queue.length) {
      const p = this.queue.shift()!;
      if (!this.lastFix || haversine(this.lastFix, p) <= p.radiusM * this.config.queueDistanceFactor) {
        this.playing = p.code;
        return p;
      }
    }
    return null;
  }

  clearQueue() {
    this.queue = [];
  }

  reset() {
    this.entered.clear();
    this.queue = [];
    this.playing = null;
    this.lastFix = null;
    this.weak = false;
  }
}

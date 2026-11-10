import L from 'leaflet';

/**
 * Lớp ảnh nền bản đồ "chịu lỗi": mỗi ô (tile) tự tìm nguồn tải được, tự thử lại khi mạng chập chờn.
 *
 * Vì sao bản cũ hay bị nền xám phải "reset mạng" mới hết:
 *  - Leaflet KHÔNG bao giờ tải lại ô đã lỗi → mạng rớt 1 lúc là xám mãi.
 *  - Chỉ đổi nguồn khi "4 ô lỗi liên tiếp và chưa tải được ô nào" → nguồn chết một phần thì không đổi.
 *  - Nguồn bị chặn (403/429) có thể trả về ảnh chữ "Access blocked" – trình duyệt vẫn vẽ ra như ảnh bình thường.
 *  - Mạng treo (không lỗi, không trả lời) thì ô đứng im vô hạn.
 *
 * Cách làm ở đây: dùng fetch (có timeout), kiểm tra HTTP 200 + đúng là ảnh, thử lần lượt nhiều nguồn độc lập
 * (server của mình → OSM → Esri → OSM-FR), rồi tự thử lại cho tới khi xong.
 */

export interface TileSource {
  id: string;
  /** Mẫu URL: {z} {x} {y} {s}. Esri dùng thứ tự {z}/{y}/{x} nên cứ viết đúng thứ tự trong mẫu. */
  url: string;
  subdomains?: string;
  /** Nguồn cùng gốc (server của mình / file đóng gói sẵn). */
  local?: boolean;
  /** Chỉ dùng cho ô nằm trong vùng/zoom này. */
  coverage?: { minZoom: number; maxZoom: number; bounds: [number, number, number, number] }; // [nam, tây, bắc, đông]
}

export const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors Tiles &copy; Esri';

/** Nguồn ảnh nền, theo thứ tự ưu tiên. Nguồn nào chết sẽ tự bị bỏ qua một lúc rồi thử lại. */
export const BASE_SOURCES: TileSource[] = [
  { id: 'proxy', url: '/maptiles/{z}/{x}/{y}.png', local: true },
  { id: 'osm', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { id: 'esri', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}' },
  { id: 'osmfr', url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', subdomains: 'abc' },
];

export type TileStatus = 'loading' | 'ok' | 'degraded';

const TIMEOUT_MS = 5000;
const ROUNDS = 2; // số vòng thử hết các nguồn cho mỗi lần tải
const DEAD_AFTER = 3; // nguồn lỗi liên tiếp từng này lần (chưa thành công lần nào) → tạm bỏ qua
const DEAD_FOR_MS = 45_000;
const AUTO_RETRY_MS = 6000;

class TileMiss extends Error {} // 404: ô không có ở nguồn này (không tính là nguồn hỏng)

// Trạng thái nguồn dùng chung cho mọi lớp bản đồ trong trang (nguồn nào đang chạy tốt thì ưu tiên)
const health = new Map<string, { fails: number; deadUntil: number; lastOk: number }>();
const h = (id: string) => {
  let v = health.get(id);
  if (!v) health.set(id, (v = { fails: 0, deadUntil: 0, lastOk: 0 }));
  return v;
};

function tileRange(bounds: [number, number, number, number], z: number) {
  const n = 2 ** z;
  const x = (lng: number) => Math.floor(((lng + 180) / 360) * n);
  const y = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };
  const [s, w, nn, e] = bounds;
  return { x0: x(w), x1: x(e), y0: y(nn), y1: y(s) };
}

function covers(src: TileSource, z: number, x: number, y: number): boolean {
  const c = src.coverage;
  if (!c) return true;
  if (z < c.minZoom || z > c.maxZoom) return false;
  const r = tileRange(c.bounds, z);
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

function fillUrl(src: TileSource, z: number, x: number, y: number): string {
  const subs = src.subdomains ?? '';
  const s = subs ? subs[Math.abs(x + y) % subs.length] : '';
  return src.url.replace('{s}', s).replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
  });
}

async function fetchTile(src: TileSource, z: number, x: number, y: number, outer: AbortSignal): Promise<Blob> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  outer.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(fillUrl(src, z, x, y), { signal: ctrl.signal, credentials: 'omit', mode: 'cors' });
    if (res.status === 404) throw new TileMiss();
    if (res.status !== 200) throw new Error('HTTP ' + res.status); // 403/429 (bị chặn), 5xx… → đổi nguồn
    if (!(res.headers.get('content-type') ?? '').startsWith('image/')) throw new TileMiss(); // vd. SPA trả index.html
    const blob = await res.blob();
    if (blob.size < 60) throw new Error('empty tile');
    return blob;
  } finally {
    clearTimeout(timer);
    outer.removeEventListener('abort', onAbort);
  }
}

interface Pending { img: HTMLImageElement; z: number; x: number; y: number; ctrl: AbortController; blobUrl?: string; running: boolean }

export class ResilientTileLayer extends L.TileLayer {
  private sources: TileSource[];
  private failed = new Set<Pending>();
  private retryTimer: number | undefined;
  private ok = 0;
  onStatus?: (s: TileStatus) => void;
  private lastStatus: TileStatus = 'loading';
  private degradedTimer: number | undefined;
  private readonly onOnline = () => this.retryAll();
  private readonly onVisible = () => { if (document.visibilityState === 'visible') this.retryAll(); };

  constructor(sources: TileSource[], options?: L.TileLayerOptions) {
    super('', { ...options, crossOrigin: false });
    this.sources = sources;
  }

  setSources(sources: TileSource[]) {
    this.sources = sources;
    this.retryAll();
  }

  override onAdd(map: L.Map) {
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onVisible);
    this.on('tileunload', this.handleUnload, this);
    // Nếu sau 8 giây vẫn chưa có ô nào hiện ra thì báo "degraded" để giao diện hiện thông báo (nền không xám trơ trọi)
    this.degradedTimer = window.setTimeout(() => { if (this.ok === 0) this.emit('degraded'); }, 8000);
    return super.onAdd(map);
  }

  override onRemove(map: L.Map) {
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.off('tileunload', this.handleUnload, this);
    window.clearTimeout(this.retryTimer);
    window.clearTimeout(this.degradedTimer);
    this.failed.clear();
    return super.onRemove(map);
  }

  override createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement('img');
    img.alt = '';
    img.setAttribute('role', 'presentation');
    img.decoding = 'async';
    const p: Pending = { img, z: coords.z, x: coords.x, y: coords.y, ctrl: new AbortController(), running: false };
    (img as HTMLImageElement & { _p?: Pending })._p = p;
    img.onload = () => done(undefined, img);
    void this.run(p);
    return img;
  }

  private handleUnload = (e: L.TileEvent) => {
    const p = (e.tile as HTMLImageElement & { _p?: Pending })._p;
    if (!p) return;
    p.ctrl.abort();
    this.failed.delete(p);
    if (p.blobUrl) URL.revokeObjectURL(p.blobUrl);
  };

  private order(z: number, x: number, y: number): TileSource[] {
    const now = Date.now();
    const usable = this.sources.filter((s) => covers(s, z, x, y));
    const alive = usable.filter((s) => h(s.id).deadUntil <= now);
    const list = alive.length ? alive : usable; // tất cả đều "chết" → vẫn thử hết, đừng bỏ cuộc
    // Nguồn vừa thành công gần nhất lên trước; còn lại giữ nguyên thứ tự ưu tiên
    return [...list].sort((a, b) => (h(b.id).lastOk > now - 60_000 ? 1 : 0) - (h(a.id).lastOk > now - 60_000 ? 1 : 0) || 0);
  }

  private async run(p: Pending): Promise<void> {
    if (p.running || p.ctrl.signal.aborted) return;
    p.running = true;
    this.failed.delete(p);
    try {
      for (let round = 0; round < ROUNDS; round++) {
        for (const src of this.order(p.z, p.x, p.y)) {
          if (p.ctrl.signal.aborted) return;
          try {
            const blob = await fetchTile(src, p.z, p.x, p.y, p.ctrl.signal);
            const st = h(src.id);
            st.fails = 0; st.deadUntil = 0; st.lastOk = Date.now();
            if (p.blobUrl) URL.revokeObjectURL(p.blobUrl);
            p.blobUrl = URL.createObjectURL(blob);
            p.img.src = p.blobUrl;
            this.ok++;
            window.clearTimeout(this.degradedTimer);
            this.emit('ok');
            return;
          } catch (err) {
            if (p.ctrl.signal.aborted) return;
            if (err instanceof TileMiss) continue;
            const st = h(src.id);
            st.fails++;
            if (st.fails >= DEAD_AFTER && st.lastOk === 0) st.deadUntil = Date.now() + DEAD_FOR_MS;
          }
        }
        if (round < ROUNDS - 1) await sleep(700, p.ctrl.signal);
      }
      // Hết cách lần này: xếp hàng thử lại tự động (không bao giờ bỏ cuộc), nền hiển thị bình thường chứ không xám
      this.failed.add(p);
      this.scheduleRetry();
      if (this.ok === 0) this.emit('degraded');
    } catch {
      /* bị hủy khi ô rời khỏi màn hình */
    } finally {
      p.running = false;
    }
  }

  private scheduleRetry() {
    if (this.retryTimer !== undefined) return;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = undefined;
      if (navigator.onLine === false) { if (this.failed.size) this.scheduleRetry(); return; }
      this.retryAll();
    }, AUTO_RETRY_MS);
  }

  /** Bấm "Thử lại", có mạng lại, hoặc quay lại tab → tải lại mọi ô đang lỗi và cho các nguồn "chết" cơ hội mới. */
  retryAll() {
    for (const s of this.sources) { const st = h(s.id); st.deadUntil = 0; st.fails = 0; }
    const items = [...this.failed];
    for (const p of items) void this.run(p);
    if (items.length && this.ok === 0) this.emit('loading');
    if (this.failed.size) this.scheduleRetry();
  }

  private emit(s: TileStatus) {
    if (s === this.lastStatus) return;
    this.lastStatus = s;
    this.onStatus?.(s);
  }
}

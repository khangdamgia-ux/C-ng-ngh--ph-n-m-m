import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchNarration, useLocations } from '../api/hooks';
import type { LocationItem, Narration } from '../api/types';
import { history, local, session } from '../storage';
import { TourEngine, type Fix, type Place } from './engine';
import type { LatLng } from './geo';
import { Narrator, type NarratorState } from './narrator';
import { BrowserGpsProvider, type LocationProvider } from './providers';

/**
 * Trạng thái định vị GPS của chính người dùng:
 * - idle: chưa bật
 * - locating: đã bật, đang chờ tọa độ đầu tiên
 * - tracking: đang theo dõi vị trí (chấm xanh trên bản đồ)
 * - error: không dùng được vị trí (từ chối quyền / thiết bị không hỗ trợ)
 */
export type GpsStatus = 'idle' | 'locating' | 'tracking' | 'error';

export interface NowPlaying {
  code: string;
  locationId: number;
  title: string;
  language: string;
  isFallback: boolean;
  hasAudio: boolean;
  auto: boolean;
}

export type UserPosition = LatLng & { accuracy: number; heading: number | null };

interface TourValue {
  places: LocationItem[];
  status: GpsStatus;
  error: string | null;
  position: UserPosition | null;
  weakGps: boolean;
  nowPlaying: NowPlaying | null;
  narratorState: NarratorState;
  progress: number;
  queue: Place[];
  /** Bật định vị GPS (gọi trong sự kiện chạm để mở khóa âm thanh cho thuyết minh tự động). */
  startGps: () => Promise<void>;
  stopGps: () => void;
  /** Tự phát thuyết minh khi đến gần di tích (chỉ có tác dụng khi GPS đang bật). */
  autoNarrate: boolean;
  setAutoNarrate: (on: boolean) => void;
  playManual: (n: Narration, place: { code: string; id: number }) => Promise<void>;
  stopNarration: () => void;
  narrator: Narrator;
}

const TourCtx = createContext<TourValue | null>(null);
const COOLDOWN_KEY = 'hoian.cooldowns';
const AUTO_KEY = 'hoian.autoNarrate';

export function toPlace(l: LocationItem): Place | null {
  if (l.latitude === null || l.longitude === null) return null;
  return { id: l.id, code: l.code, title: l.title, lat: l.latitude, lng: l.longitude, radiusM: l.triggerRadiusM, priority: l.priority };
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const { data } = useLocations(lang);
  const places = useMemo(() => data?.items ?? [], [data]);

  const [status, setStatus] = useState<GpsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [weakGps, setWeakGps] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [narratorState, setNarratorState] = useState<NarratorState>('idle');
  const [progress, setProgress] = useState(0);
  const [queue, setQueue] = useState<Place[]>([]);
  const [autoNarrate, setAutoNarrateState] = useState<boolean>(() => local.read(AUTO_KEY, true));

  const engine = useRef(new TourEngine(undefined, session.read(COOLDOWN_KEY, {})));
  const provider = useRef<LocationProvider | null>(null);
  const nowPlayingRef = useRef<NowPlaying | null>(null);
  const langRef = useRef(lang);
  const autoRef = useRef(autoNarrate);
  const hasFixRef = useRef(false);
  /** Vị trí gần nhất – để bộ máy vẫn “đếm giờ” khi khách đứng yên và trình duyệt không báo tọa độ mới. */
  const lastFixRef = useRef<Fix | null>(null);
  langRef.current = lang;
  autoRef.current = autoNarrate;

  // Trình phát dùng chung cho thuyết minh tự động và trang chi tiết
  const playNextRef = useRef<() => void>(() => undefined);
  const narrator = useMemo(
    () =>
      new Narrator({
        onState: (s) => setNarratorState(s),
        onProgress: (f) => setProgress(f),
        onEnded: () => {
          setProgress(0);
          playNextRef.current();
        },
      }),
    [],
  );

  useEffect(() => {
    engine.current.setPlaces(places.map(toPlace).filter((p): p is Place => p !== null));
  }, [places]);

  const setCurrent = (np: NowPlaying | null) => {
    nowPlayingRef.current = np;
    setNowPlaying(np);
  };

  const playPlace = useCallback(
    async (place: Place, auto: boolean) => {
      try {
        const n = await fetchNarration(place.code, langRef.current);
        engine.current.setPlaying(place.code);
        setCurrent({ code: place.code, locationId: place.id, title: n.title, language: n.language, isFallback: n.isFallback, hasAudio: !!n.audio, auto });
        history.add(place.code, n.title);
        await narrator.play({ key: place.code, title: n.title, content: n.content, language: n.language, audioUrl: n.audio?.url ?? null });
      } catch {
        // Không có nội dung → bỏ qua, chuyển bài kế
        engine.current.setPlaying(null);
        playNextRef.current();
      }
    },
    [narrator],
  );

  playNextRef.current = () => {
    const next = engine.current.next();
    setQueue([...engine.current.queued]);
    if (next) void playPlace(next, true);
    else setCurrent(null);
  };

  /** Đưa vị trí vào bộ máy thuyết minh; phát/xếp hàng các điểm đủ điều kiện. */
  const runEngine = useCallback(
    (fix: Fix) => {
      if (!autoRef.current) return; // Không tự thuyết minh: chỉ cập nhật vị trí
      for (const ev of engine.current.onFix(fix)) {
        if (ev.type !== 'trigger') continue;
        if (ev.action === 'play') void playPlace(ev.place, true);
        else setQueue([...engine.current.queued]);
      }
      session.write(COOLDOWN_KEY, engine.current.cooldowns());
    },
    [playPlace],
  );

  const onFix = useCallback(
    (raw: Fix & { heading?: number | null }) => {
      hasFixRef.current = true;
      // Dùng đồng hồ máy cho mọi mẫu → thời gian “đứng trong vùng ≥ 3 giây” luôn nhất quán với nhịp kiểm tra bên dưới
      const fix: Fix = { lat: raw.lat, lng: raw.lng, accuracy: raw.accuracy, timestamp: Date.now() };
      lastFixRef.current = fix;
      setStatus('tracking');
      setError(null);
      setPosition({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, heading: raw.heading ?? null });
      // Tín hiệu yếu = sai số vượt ngưỡng hiện hành của bộ máy thuyết minh
      setWeakGps(fix.accuracy > engine.current.accuracyLimit);
      runEngine(fix);
    },
    [runEngine],
  );

  // Khách đứng yên thì trình duyệt thường KHÔNG báo tọa độ mới → bộ máy sẽ không bao giờ đếm đủ 3 giây.
  // Mỗi giây nạp lại vị trí gần nhất (tối đa 2 phút tuổi) để thuyết minh vẫn tự phát khi đứng yên trong vùng.
  useEffect(() => {
    if (status !== 'tracking' || !autoNarrate) return;
    const id = setInterval(() => {
      const f = lastFixRef.current;
      if (!f || Date.now() - f.timestamp > 120_000) return;
      runEngine({ ...f, timestamp: Date.now() });
    }, 1000);
    return () => clearInterval(id);
  }, [status, autoNarrate, runEngine]);

  const beginWatch = useCallback(() => {
    provider.current?.stop();
    const p = new BrowserGpsProvider();
    provider.current = p;
    engine.current.reset();
    hasFixRef.current = false;
    lastFixRef.current = null;
    setError(null);
    setWeakGps(false);
    setStatus('locating');
    p.start(onFix, (code) => {
      // Hết thời gian chờ / tạm mất tín hiệu là lỗi thoáng qua (hay gặp trên điện thoại): vẫn tiếp tục theo dõi,
      // có tọa độ mới là tự trở lại bình thường. Chỉ dừng hẳn khi bị từ chối quyền hoặc thiết bị không hỗ trợ.
      if (code === 'timeout' || code === 'unavailable') {
        setWeakGps(true);
        if (!hasFixRef.current) {
          setStatus('error');
          setError(code);
        }
        return;
      }
      provider.current?.stop();
      provider.current = null;
      setStatus('error');
      setError(code);
    });
  }, [onFix]);

  const startGps = useCallback(async () => {
    // Lần chạm này mở khóa âm thanh để thuyết minh tự động phát được về sau (chính sách autoplay)
    await narrator.unlock();
    beginWatch();
  }, [beginWatch, narrator]);

  const stopGps = useCallback(() => {
    provider.current?.stop();
    provider.current = null;
    engine.current.reset();
    setStatus('idle');
    setError(null);
    setPosition(null);
    setQueue([]);
    setWeakGps(false);
  }, []);

  const setAutoNarrate = useCallback((on: boolean) => {
    autoRef.current = on;
    setAutoNarrateState(on);
    local.write(AUTO_KEY, on);
    if (!on) {
      engine.current.clearQueue();
      setQueue([]);
    } else {
      engine.current.reset();
    }
  }, []);

  /** Nghe thủ công từ trang chi tiết – đánh dấu để thuyết minh tự động không phát lại. */
  const playManual = useCallback(
    async (n: Narration, place: { code: string; id: number }) => {
      await narrator.unlock();
      engine.current.markPlayed(place.code, Date.now());
      engine.current.setPlaying(place.code);
      setCurrent({ code: place.code, locationId: place.id, title: n.title, language: n.language, isFallback: n.isFallback, hasAudio: !!n.audio, auto: false });
      history.add(place.code, n.title);
      await narrator.play({ key: place.code, title: n.title, content: n.content, language: n.language, audioUrl: n.audio?.url ?? null });
    },
    [narrator],
  );

  const stopNarration = useCallback(() => {
    engine.current.clearQueue();
    engine.current.setPlaying(null);
    setQueue([]);
    narrator.stop(false);
    setCurrent(null);
    setProgress(0);
  }, [narrator]);

  useEffect(() => () => provider.current?.stop(), []);

  const value: TourValue = {
    places, status, error, position, weakGps, nowPlaying, narratorState, progress, queue,
    startGps, stopGps, autoNarrate, setAutoNarrate, playManual, stopNarration, narrator,
  };

  return <TourCtx.Provider value={value}>{children}</TourCtx.Provider>;
}

export function useTour() {
  const v = useContext(TourCtx);
  if (!v) throw new Error('useTour phải nằm trong TourProvider');
  return v;
}

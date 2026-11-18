import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchNarration, useLocations } from '../api/hooks';
import type { LocationItem, Narration } from '../api/types';
import { track } from '../analytics';
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
  wakeLock: 'active' | 'unsupported' | 'off';
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
  /** Phạm vi “điểm ở gần” (mét): khi tự thuyết minh bật, điểm nào trong phạm vi này (gần nhất trước) sẽ tự phát. */
  nearbyRadius: number;
  setNearbyRadius: (m: number) => void;
  playManual: (n: Narration, place: { code: string; id: number }) => Promise<void>;
  stopNarration: () => void;
  narrator: Narrator;
}

const TourCtx = createContext<TourValue | null>(null);
const COOLDOWN_KEY = 'hoian.cooldowns';
const GPS_KEY = 'hoian.gps';
const AUTO_KEY = 'hoian.autoNarrate';
const NEARBY_RADIUS_KEY = 'hoian.nearbyRadius';
/** Các mức bán kính “điểm ở gần” cho khách chọn (mét). */
export const NEARBY_RADII = [50, 100, 200] as const;

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
  const [wakeLock, setWakeLock] = useState<TourValue['wakeLock']>('off');
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [narratorState, setNarratorState] = useState<NarratorState>('idle');
  const [progress, setProgress] = useState(0);
  const [queue, setQueue] = useState<Place[]>([]);
  const [autoNarrate, setAutoNarrateState] = useState<boolean>(() => local.read(AUTO_KEY, true));
  const [nearbyRadius, setNearbyRadiusState] = useState<number>(() => {
    const v = local.read<number>(NEARBY_RADIUS_KEY, 100);
    return (NEARBY_RADII as readonly number[]).includes(v) ? v : 100;
  });

  const engine = useRef(new TourEngine(undefined, session.read(COOLDOWN_KEY, {})));
  const provider = useRef<LocationProvider | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
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
        onState: (s) => {
          setNarratorState(s);
          if (s === 'blocked' && 'vibrate' in navigator) navigator.vibrate?.(200);
        },
        onProgress: (f) => setProgress(f),
        onEnded: (_item, completed) => {
          const np = nowPlayingRef.current;
          if (np && completed) track('AUDIO_COMPLETE', np.locationId);
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
        if (auto) track('GEOFENCE_TRIGGER', place.id);
        track('AUDIO_PLAY', place.id);
        if ('vibrate' in navigator) navigator.vibrate?.(60);
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
        else {
          track('GEOFENCE_TRIGGER', ev.place.id);
          setQueue([...engine.current.queued]);
        }
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

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return setWakeLock('unsupported');
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setWakeLock('active');
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
        setWakeLock('off');
      });
    } catch {
      setWakeLock('unsupported');
    }
  }, []);

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
      if (code === 'denied') local.write(GPS_KEY, false);
    });
  }, [onFix]);

  const startGps = useCallback(async () => {
    // Lần chạm này mở khóa âm thanh để thuyết minh tự động phát được về sau (chính sách autoplay)
    await narrator.unlock();
    void requestWakeLock();
    local.write(GPS_KEY, true);
    track('TOUR_START');
    beginWatch();
  }, [beginWatch, narrator, requestWakeLock]);

  const stopGps = useCallback(() => {
    provider.current?.stop();
    provider.current = null;
    engine.current.reset();
    void wakeLockRef.current?.release();
    wakeLockRef.current = null;
    local.write(GPS_KEY, false);
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

  // Chế độ “điểm ở gần” gắn liền với công tắc tự thuyết minh: bật → nới bán kính kích hoạt tới phạm vi đã chọn; tắt → bộ máy không chạy
  useEffect(() => {
    engine.current.setNearby(autoNarrate ? nearbyRadius : null);
  }, [autoNarrate, nearbyRadius]);

  const setNearbyRadius = useCallback((m: number) => {
    setNearbyRadiusState(m);
    local.write(NEARBY_RADIUS_KEY, m);
  }, []);

  /** Nghe thủ công từ trang chi tiết – đánh dấu để thuyết minh tự động không phát lại. */
  const playManual = useCallback(
    async (n: Narration, place: { code: string; id: number }) => {
      await narrator.unlock();
      engine.current.markPlayed(place.code, Date.now());
      engine.current.setPlaying(place.code);
      setCurrent({ code: place.code, locationId: place.id, title: n.title, language: n.language, isFallback: n.isFallback, hasAudio: !!n.audio, auto: false });
      history.add(place.code, n.title);
      track('AUDIO_PLAY', place.id);
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

  /**
   * Đổi ngôn ngữ khi đang nghe → tự tải bản thuyết minh của ngôn ngữ mới và phát tiếp ngay,
   * không cần tắt rồi bật lại. Đang tạm dừng thì nạp sẵn bản mới, bấm Phát là nghe ngôn ngữ mới.
   */
  useEffect(() => {
    const np = nowPlayingRef.current;
    if (!np) return;
    let cancelled = false;
    void (async () => {
      try {
        const n = await fetchNarration(np.code, lang);
        const cur = nowPlayingRef.current;
        if (cancelled || !cur || cur.code !== np.code) return;
        setCurrent({ ...cur, title: n.title, language: n.language, isFallback: n.isFallback, hasAudio: !!n.audio });
        const playingItem = narrator.current;
        // Ngôn ngữ mới chưa có bản dịch và dự phòng về đúng bản đang phát → giữ nguyên, không phát lại từ đầu
        if (playingItem && playingItem.key === np.code && playingItem.language === n.language) return;
        setProgress(0);
        await narrator.swap({ key: np.code, title: n.title, content: n.content, language: n.language, audioUrl: n.audio?.url ?? null });
      } catch {
        /* Không tải được bản mới → giữ bản đang phát */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, narrator]);

  // Lần sau mở lại trang: nếu người dùng đã bật GPS và đã cấp quyền thì tự bật lại định vị
  useEffect(() => {
    if (!local.read(GPS_KEY, false) || !('permissions' in navigator)) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (p.state === 'granted' && !provider.current) beginWatch();
      })
      .catch(() => undefined);
    // chỉ chạy một lần khi tải trang
  }, []);

  // Quay lại tab → tự xin lại Wake Lock khi GPS đang bật (TC46)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && status === 'tracking' && !wakeLockRef.current) void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status, requestWakeLock]);

  useEffect(() => () => provider.current?.stop(), []);

  // [YÊU CẦU MỚI] Thuyết minh được 5 giây → tạm dừng và hỏi "Bạn có muốn nghe tiếp không?"
  const [askContinue, setAskContinue] = useState(false);
  const askedRef = useRef<NowPlaying | null>(null); // bài đã hỏi rồi thì không hỏi lại
  useEffect(() => {
    if (narratorState !== 'playing' || !nowPlaying || askedRef.current === nowPlaying) return;
    const timer = window.setTimeout(() => {
      askedRef.current = nowPlaying;
      narrator.pause();
      setAskContinue(true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [narratorState, nowPlaying, narrator]);

  const answerContinue = (yes: boolean) => {
    setAskContinue(false);
    if (yes) narrator.resume();
    else stopNarration();
  };

  const value: TourValue = {
    places, status, error, position, weakGps, wakeLock, nowPlaying, narratorState, progress, queue,
    startGps, stopGps, autoNarrate, setAutoNarrate, nearbyRadius, setNearbyRadius, playManual, stopNarration, narrator,
  };

  return (
    <TourCtx.Provider value={value}>
      {children}
      {askContinue && nowPlaying && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#fff', color: '#222', padding: 24, borderRadius: 12, maxWidth: 320, textAlign: 'center' }}>
            <p style={{ marginTop: 0, fontWeight: 600 }}>Bạn có muốn nghe tiếp không?</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => answerContinue(true)}>Có</button>
              <button onClick={() => answerContinue(false)}>Không</button>
            </div>
          </div>
        </div>
      )}
    </TourCtx.Provider>
  );
}

export function useTour() {
  const v = useContext(TourCtx);
  if (!v) throw new Error('useTour phải nằm trong TourProvider');
  return v;
}

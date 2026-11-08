import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocations } from '../api/hooks';
import type { LocationItem, Narration } from '../api/types';
import type { LatLng } from './geo';
import { Narrator, type NarratorState } from './narrator';
import { BrowserGpsProvider, type GpsFix, type LocationProvider } from './providers';

/**
 * Trạng thái định vị GPS của chính người dùng:
 * - idle: chưa bật
 * - locating: đã bật, đang chờ tọa độ đầu tiên
 * - tracking: đang theo dõi vị trí (chấm xanh trên bản đồ)
 * - error: không dùng được vị trí (từ chối quyền / thiết bị không hỗ trợ)
 */
export type GpsStatus = 'idle' | 'locating' | 'tracking' | 'error';

/** Sai số GPS lớn hơn ngưỡng này (mét) thì báo “tín hiệu yếu”. */
const WEAK_GPS_M = 30;

export interface NowPlaying {
  code: string;
  locationId: number;
  title: string;
  language: string;
  isFallback: boolean;
  hasAudio: boolean;
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
  /** Bật định vị GPS của người dùng. */
  startGps: () => void;
  stopGps: () => void;
  /** Nghe thuyết minh (bấm Phát trên trang chi tiết). */
  playManual: (n: Narration, place: { code: string; id: number }) => Promise<void>;
  stopNarration: () => void;
  narrator: Narrator;
}

const TourCtx = createContext<TourValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const { data } = useLocations(i18n.language);
  const places = useMemo(() => data?.items ?? [], [data]);

  const [status, setStatus] = useState<GpsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [weakGps, setWeakGps] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [narratorState, setNarratorState] = useState<NarratorState>('idle');
  const [progress, setProgress] = useState(0);

  const provider = useRef<LocationProvider | null>(null);
  const hasFixRef = useRef(false);

  // Trình phát dùng chung cho trang chi tiết và thanh phát nổi
  const narrator = useMemo(
    () =>
      new Narrator({
        onState: (s) => setNarratorState(s),
        onProgress: (f) => setProgress(f),
        onEnded: () => {
          setProgress(0);
          setNowPlaying(null);
        },
      }),
    [],
  );

  const onFix = useCallback((fix: GpsFix) => {
    hasFixRef.current = true;
    setStatus('tracking');
    setError(null);
    setPosition({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, heading: fix.heading });
    setWeakGps(fix.accuracy > WEAK_GPS_M);
  }, []);

  const startGps = useCallback(() => {
    provider.current?.stop();
    const p = new BrowserGpsProvider();
    provider.current = p;
    hasFixRef.current = false;
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

  const stopGps = useCallback(() => {
    provider.current?.stop();
    provider.current = null;
    setStatus('idle');
    setError(null);
    setPosition(null);
    setWeakGps(false);
  }, []);

  const playManual = useCallback(
    async (n: Narration, place: { code: string; id: number }) => {
      await narrator.unlock();
      setNowPlaying({ code: place.code, locationId: place.id, title: n.title, language: n.language, isFallback: n.isFallback, hasAudio: !!n.audio });
      await narrator.play({ key: place.code, title: n.title, content: n.content, language: n.language, audioUrl: n.audio?.url ?? null });
    },
    [narrator],
  );

  const stopNarration = useCallback(() => {
    narrator.stop(false);
    setNowPlaying(null);
    setProgress(0);
  }, [narrator]);

  useEffect(() => () => provider.current?.stop(), []);

  const value: TourValue = {
    places, status, error, position, weakGps, nowPlaying, narratorState, progress,
    startGps, stopGps, playManual, stopNarration, narrator,
  };

  return <TourCtx.Provider value={value}>{children}</TourCtx.Provider>;
}

export function useTour() {
  const v = useContext(TourCtx);
  if (!v) throw new Error('useTour phải nằm trong TourProvider');
  return v;
}

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLocations } from '../api/hooks';
import type { LocationItem, Narration } from '../api/types';
import { Narrator, type NarratorState } from './narrator';

export interface NowPlaying {
  code: string;
  locationId: number;
  title: string;
  language: string;
  hasAudio: boolean;
}

interface TourValue {
  places: LocationItem[];
  nowPlaying: NowPlaying | null;
  narratorState: NarratorState;
  progress: number;
  /** Nghe thuyết minh (bấm Phát trên trang chi tiết). */
  playManual: (n: Narration, place: { code: string; id: number }) => Promise<void>;
  stopNarration: () => void;
  narrator: Narrator;
}

const TourCtx = createContext<TourValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const { data } = useLocations();
  const places = useMemo(() => data?.items ?? [], [data]);

  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [narratorState, setNarratorState] = useState<NarratorState>('idle');
  const [progress, setProgress] = useState(0);

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

  const playManual = useCallback(
    async (n: Narration, place: { code: string; id: number }) => {
      await narrator.unlock();
      setNowPlaying({ code: place.code, locationId: place.id, title: n.title, language: n.language, hasAudio: !!n.audio });
      await narrator.play({ key: place.code, title: n.title, content: n.content, language: n.language, audioUrl: n.audio?.url ?? null });
    },
    [narrator],
  );

  const stopNarration = useCallback(() => {
    narrator.stop(false);
    setNowPlaying(null);
    setProgress(0);
  }, [narrator]);

  const value: TourValue = {
    places, nowPlaying, narratorState, progress, playManual, stopNarration, narrator,
  };

  return <TourCtx.Provider value={value}>{children}</TourCtx.Provider>;
}

export function useTour() {
  const v = useContext(TourCtx);
  if (!v) throw new Error('useTour phải nằm trong TourProvider');
  return v;
}

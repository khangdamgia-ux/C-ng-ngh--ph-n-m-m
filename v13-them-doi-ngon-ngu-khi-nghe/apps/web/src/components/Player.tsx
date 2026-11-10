import { useTranslation } from 'react-i18next';
import type { Narration } from '../api/types';
import { useTour } from '../tour/TourContext';

/** Trình phát trên trang chi tiết (FR-04): phát/tạm dừng, tua ±10 s, tốc độ, nghe lại. */
export function Player({ narration, locationId }: { narration: Narration; locationId: number }) {
  const { t } = useTranslation();
  const { nowPlaying, narratorState, progress, narrator, playManual } = useTour();
  const active = nowPlaying?.code === narration.locationCode;
  const playing = active && narratorState === 'playing';

  const toggle = () => {
    if (!active) return void playManual(narration, { code: narration.locationCode, id: locationId });
    if (narratorState === 'playing') narrator.pause();
    else narrator.resume();
  };

  return (
    <div className="player">
      <div className="row" style={{ fontSize: 13 }}>
        <b className="player-title"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2zM20 15a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z" /></svg>{t('player.title')}</b>
        <label>
          <span className="sr-only">Speed</span>
          <select defaultValue="1" onChange={(e) => narrator.setRate(Number(e.target.value))} aria-label="speed">
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
          </select>
        </label>
      </div>
      {!narration.audio && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{t('player.tts')}</div>}
      <div className="bar"><i style={{ width: `${active ? Math.round(progress * 100) : 0}%` }} /></div>
      <div className="ctl">
        <button onClick={() => narrator.seek(-10)} disabled={!active} aria-label={t('player.back')}>⏪ 10</button>
        <button className="main" onClick={toggle} aria-label={playing ? t('player.pause') : t('player.play')}>{playing ? '❚❚' : '▶'}</button>
        <button onClick={() => narrator.seek(10)} disabled={!active} aria-label={t('player.forward')}>10 ⏩</button>
        <button onClick={() => (active ? narrator.restart() : toggle())} aria-label={t('player.restart')}>↺</button>
      </div>
      {active && narratorState === 'blocked' && <button className="big-play" onClick={() => narrator.resume()}>▶ {t('tour.playNow')}</button>}
      {active && narratorState === 'error' && <div className="notice error" style={{ marginTop: 8 }}>{t('player.error')}</div>}
    </div>
  );
}

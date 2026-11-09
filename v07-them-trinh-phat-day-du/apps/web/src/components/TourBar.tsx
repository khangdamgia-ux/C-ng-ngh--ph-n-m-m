import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTour } from '../tour/TourContext';

/** Thanh phát nổi: bài đang thuyết minh (tự động hoặc thủ công), ngôn ngữ đang đọc. */
export function TourBar() {
  const { t } = useTranslation();
  const tour = useTour();
  const { nowPlaying, narratorState, progress } = tour;
  const { pathname } = useLocation();
  // Trang chi tiết của chính bài đang phát đã có trình phát lớn → ẩn thanh nổi cho gọn
  if (!nowPlaying || pathname === `/l/${nowPlaying.code}`) return null;
  const playing = narratorState === 'playing';

  return (
    <div className="tourbar" role="region" aria-label={t('player.title')}>
      <div className="tb-main">
        {narratorState !== 'blocked' && (
          <button className="tb-play" onClick={() => (playing ? tour.narrator.pause() : tour.narrator.resume())} aria-label={playing ? t('player.pause') : t('player.play')}>
            {playing ? <svg viewBox="0 0 24 24" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg> : <svg viewBox="0 0 24 24" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>}
          </button>
        )}
        <div className="tb-text">
          <div className="live">
            {playing && <span className="eq" aria-hidden><i /><i /><i /></span>}
            {nowPlaying.auto ? t('tour.nowPlaying') : t('player.title')}
            <span className="lang-tag">{nowPlaying.language.toUpperCase()}</span>
          </div>
          <Link to={`/l/${nowPlaying.code}`} className="title">{nowPlaying.title}</Link>
        </div>
        <button className="tb-close" onClick={tour.stopNarration} aria-label="Stop">
          <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      {narratorState === 'blocked' && (
        <button className="big-play" onClick={() => tour.narrator.resume()}>▶ {t('tour.playNow')}</button>
      )}
      {narratorState === 'error' && <div className="notice error">{t('player.error')}</div>}
    </div>
  );
}

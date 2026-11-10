import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistance } from '../tour/geo';
import { useTour } from '../tour/TourContext';
import { useNearest } from './useNearest';

/** Khối định vị GPS của chính người dùng: bật/tắt, độ chính xác, di tích gần nhất, tự thuyết minh. */
export function GpsCard({ tone = 'light' }: { tone?: 'light' | 'on-hero' }) {
  const { t } = useTranslation();
  const { status, error, position, weakGps, places, startGps, stopGps, autoNarrate, setAutoNarrate } = useTour();
  const nearest = useNearest(places, position);

  if (status === 'idle') {
    return (
      <div className={`gps-card ${tone}`}>
        <button className="gps-start" onClick={() => void startGps()}>
          <span className="gps-ico" aria-hidden><GpsIcon /></span>
          <span>
            <strong>{t('gps.enable')}</strong>
            <small>{t('gps.enableHint')}</small>
          </span>
        </button>
        <p className="privacy">{t('privacy.note')}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`gps-card ${tone}`} role="alert">
        <div className="gps-status err">
          <span className="gps-dot" />
          <span>{error === 'denied' ? t('gps.denied') : t('gps.unavailable')}</span>
        </div>
        <div className="gps-actions">
          <button className="btn small primary" onClick={() => void startGps()}>{t('gps.retry')}</button>
          <button className="btn small ghost" onClick={stopGps}>{t('gps.off')}</button>
        </div>
      </div>
    );
  }

  const inside = nearest && nearest.distance <= nearest.place.triggerRadiusM;
  return (
    <div className={`gps-card ${tone} on`} role="status" aria-live="polite">
      <div className="gps-status">
        <span className={`gps-dot ${status === 'locating' ? 'wait' : weakGps ? 'weak' : 'ok'}`} />
        <b>{status === 'locating' ? t('gps.locating') : t('gps.on')}</b>
        {position && <span className="gps-acc">{t('gps.accuracy', { m: Math.round(position.accuracy) })}</span>}
      </div>
      {weakGps && <p className="gps-note">{t('tour.weakGps')}</p>}
      {nearest && (
        <Link className="gps-nearest" to={`/l/${nearest.place.code}`}>
          <span className="lbl">{inside ? t('gps.here') : t('gps.nearest')}</span>
          <span className="nm">{nearest.place.title}</span>
          {!inside && <span className="dist">{formatDistance(nearest.distance)} {t('gps.away')}</span>}
        </Link>
      )}
      <div className="gps-actions">
        <label className="switch">
          <input type="checkbox" checked={autoNarrate} onChange={(e) => setAutoNarrate(e.target.checked)} />
          <span className="track" aria-hidden />
          {t('gps.auto')}
        </label>
        <button className="btn small ghost" onClick={stopGps}>{t('gps.off')}</button>
      </div>
    </div>
  );
}

export function GpsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNarration } from '../api/hooks';
import { usePageTitle } from '../components/usePageTitle';
import { Player } from '../components/Player';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/icons';
import { CATEGORY_ICON } from './Home';

/** UI03: chi tiết địa điểm + trình phát (FR-04, FR-10) + link chỉ đường Google Maps. */
export function Detail() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const loc = useLocation(code);
  const narration = useNarration(code);
  usePageTitle(loc.data?.title ?? '');

  if (loc.isLoading) return <div className="skeleton" style={{ height: 220 }} />;
  if (loc.isError || !loc.data) {
    return (
      <div className="empty">
        <p>{t('detail.notFound')}</p>
        <Link className="btn" to="/places">{t('nav.places')}</Link>
      </div>
    );
  }
  const l = loc.data;
  const n = narration.data;
  const directions = l.latitude !== null ? `https://www.google.com/maps/dir/?api=1&destination=${l.latitude},${l.longitude}&travelmode=walking` : null;

  return (
    <article className="detail">
      <div className="detail-cover">
        <Thumb code={l.code} title={n?.title ?? l.title} imageUrl={l.imageUrl} className="detail-hero" />
        <button className="back-btn" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))} aria-label={t('detail.back')}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
        </button>
        <div className="detail-cover-text">
          <span className="card-tag static"><Icon name={CATEGORY_ICON[l.category.code] ?? 'pin'} size={14} />{t(`category.${l.category.code}`, { defaultValue: l.category.name })}</span>
          <h1>{n?.title ?? l.title}</h1>
          {l.address && (
            <p className="detail-meta">
              <span><Icon name="pin" size={15} />{l.address}</span>
            </p>
          )}
        </div>
      </div>

      {narration.isError && <div className="notice">{t('detail.noNarration')}</div>}
      {n && <Player narration={n} locationId={l.id} />}

      <div className="info">
        {l.openingHours && <div><Icon name="clock" size={20} /><span><b>{t('detail.openingHours')}</b>{l.openingHours}</span></div>}
        {l.ticketPrice !== null && <div><Icon name="ticket" size={20} /><span><b>{t('detail.ticket')}</b>{l.ticketPrice.toLocaleString('vi-VN')} ₫</span></div>}
        {l.address && <div><Icon name="pin" size={20} /><span><b>{t('detail.address')}</b>{l.address}</span></div>}
      </div>

      <div className="btns">
        {directions && <a className="btn primary" href={directions} target="_blank" rel="noreferrer"><Icon name="route" size={18} />{t('detail.directions')}</a>}
        {'share' in navigator && (
          <button className="btn" onClick={() => void navigator.share({ title: n?.title ?? l.title, url: `${location.origin}/l/${l.code}` }).catch(() => undefined)}><Icon name="share" size={18} />{t('detail.share')}</button>
        )}
      </div>

      {n && <div className="narration-text" lang={n.language}>{n.content}</div>}
    </article>
  );
}

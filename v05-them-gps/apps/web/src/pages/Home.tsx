import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocations } from '../api/hooks';
import { LocationCard } from '../components/LocationCard';
import { Icon, type IconName } from '../components/icons';
import { useTour } from '../tour/TourContext';
import { haversine } from '../tour/geo';

/** Biểu tượng cho từng loại di tích (khớp mã danh mục trong CSDL). */
export const CATEGORY_ICON: Record<string, IconName> = {
  DINH_CHUA_MIEU: 'pagoda',
  HOI_QUAN: 'gate',
  NHA_CO: 'house',
  BAO_TANG: 'museum',
  CHO_PHO_DEM: 'lantern',
};

export function Home() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const { data, isLoading, isError, refetch } = useLocations(i18n.language);
  const { position, nowPlaying } = useTour();

  const items = useMemo(() => {
    const list = (data?.items ?? []).map((l) => ({ l, d: position && l.latitude !== null ? haversine(position, { lat: l.latitude, lng: l.longitude! }) : null }));
    if (position) list.sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity));
    return list.slice(0, 6);
  }, [data, position]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(text.trim() ? `/places?q=${encodeURIComponent(text.trim())}` : '/places');
  };

  return (
    <>
      <section className="hero">
        <img className="hero-img" src="/hero-hoian.png" alt="Chùa Cầu – Phố cổ Hội An" width={447} height={447} fetchPriority="high" />
        <div className="hero-text">
          <span className="hero-badge">{t('home.badge')}</span>
          <h1>{t('home.heroTitle')}</h1>
          <p>{t('home.lead')}</p>
          <form className="hero-search" onSubmit={search} role="search">
            <Icon name="search" size={20} />
            <label className="sr-only" htmlFor="hero-q">{t('search.placeholder')}</label>
            <input id="hero-q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('search.placeholder')} />
            <button type="submit">{t('home.search')}</button>
          </form>
        </div>
      </section>

      <section className="block">
        <div className="row section-head">
          <h2 className="section-title">{position ? t('home.near') : t('home.all')}</h2>
          <Link to="/places" className="link-more">{t('home.viewAll')}<Icon name="arrowRight" size={16} /></Link>
        </div>
        {data?.contentDegraded && <div className="notice">{t('common.offline')}</div>}
        {isLoading && <div className="grid">{[1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>}
        {isError && (
          <div className="notice error">
            {t('common.error')} <button className="btn small" onClick={() => void refetch()}>{t('common.retry')}</button>
          </div>
        )}
        <div className="grid grid-3">
          {items.map(({ l, d }) => <LocationCard key={l.code} item={l} distance={d} playing={nowPlaying?.code === l.code} />)}
        </div>
      </section>
    </>
  );
}

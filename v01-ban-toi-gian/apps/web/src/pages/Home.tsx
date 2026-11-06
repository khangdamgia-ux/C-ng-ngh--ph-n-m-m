import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocations } from '../api/hooks';
import { LocationCard } from '../components/LocationCard';
import { Icon, type IconName } from '../components/icons';
import { useTour } from '../tour/TourContext';

/** Biểu tượng cho từng loại di tích (khớp mã danh mục trong CSDL). */
export const CATEGORY_ICON: Record<string, IconName> = {
  DINH_CHUA_MIEU: 'pagoda',
  HOI_QUAN: 'gate',
  NHA_CO: 'house',
  BAO_TANG: 'museum',
  CHO_PHO_DEM: 'lantern',
};

export function Home() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useLocations();
  const { nowPlaying } = useTour();

  const items = (data?.items ?? []).slice(0, 6);

  return (
    <>
      <section className="hero">
        <img className="hero-img" src="/hero-hoian.png" alt="Chùa Cầu – Phố cổ Hội An" width={447} height={447} fetchPriority="high" />
        <div className="hero-text">
          <span className="hero-badge">{t('home.badge')}</span>
          <h1>{t('home.heroTitle')}</h1>
          <p>{t('home.lead')}</p>
        </div>
      </section>

      <section className="block">
        <div className="row section-head">
          <h2 className="section-title">{t('home.all')}</h2>
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
          {items.map((l) => <LocationCard key={l.code} item={l} playing={nowPlaying?.code === l.code} />)}
        </div>
      </section>
    </>
  );
}

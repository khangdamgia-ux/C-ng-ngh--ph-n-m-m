import { useTranslation } from 'react-i18next';
import { useLocations } from '../api/hooks';
import { LocationCard } from '../components/LocationCard';
import { useTour } from '../tour/TourContext';

/** UI02: danh sách toàn bộ di tích (FR-06). */
export function Places() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useLocations();
  const { nowPlaying } = useTour();
  const items = data?.items ?? [];

  return (
    <>
      <header className="page-intro">
        <h1>{t('places.title')}</h1>
      </header>
      <div className="row list-meta">
        <span className="muted">{t('list.results', { count: items.length })}</span>
      </div>
      {isLoading && <div className="grid">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" />)}</div>}
      {isError && <div className="notice error">{t('common.error')} <button className="btn small" onClick={() => void refetch()}>{t('common.retry')}</button></div>}
      <div className="grid" style={{ marginTop: 10 }}>
        {items.map((l) => <LocationCard key={l.code} item={l} playing={nowPlaying?.code === l.code} />)}
      </div>
    </>
  );
}

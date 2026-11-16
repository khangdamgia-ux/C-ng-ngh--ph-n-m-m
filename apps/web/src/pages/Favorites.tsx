import { useTranslation } from 'react-i18next';
import { useLocations } from '../api/hooks';
import { LocationCard } from '../components/LocationCard';
import { useStorageVersion } from '../components/useStorageVersion';
import { favorites } from '../storage';

export function Favorites() {
  const { t, i18n } = useTranslation();
  useStorageVersion();
  const { data } = useLocations(i18n.language);
  const codes = favorites.list();
  const items = (data?.items ?? []).filter((l) => codes.includes(l.code));
  return (
    <>
      <header className="page-intro"><h1>{t('favorites.title')}</h1></header>
      <p className="muted page-note">{t('history.note')}</p>
      {items.length === 0 ? <div className="empty">{t('favorites.empty')}</div> : <div className="grid">{items.map((l) => <LocationCard key={l.code} item={l} />)}</div>}
    </>
  );
}

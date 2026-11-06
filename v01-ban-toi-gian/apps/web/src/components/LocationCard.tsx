import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LocationItem } from '../api/types';
import { Icon } from './icons';
import { Thumb } from './Thumb';

export function LocationCard({ item, playing }: { item: LocationItem; playing?: boolean }) {
  const { t } = useTranslation();
  return (
    <Link to={`/l/${item.code}`} className={`card${playing ? ' is-playing' : ''}`}>
      <div className="card-media">
        <Thumb code={item.code} title={item.title} imageUrl={item.imageUrl} />
        <span className="card-tag">{t(`category.${item.category.code}`, { defaultValue: item.category.name })}</span>
        {playing && <span className="card-live"><span className="eq"><i /><i /><i /></span>{t('player.title')}</span>}
      </div>
      <div className="card-body">
        <h3>{item.title}</h3>
        <p>{item.summary ?? item.address}</p>
        <div className="card-foot">
          <span className="listen"><Icon name="headphones" size={16} />{t('card.listen')}</span>
        </div>
      </div>
    </Link>
  );
}

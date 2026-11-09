import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCategories, useLocations } from '../api/hooks';
import { LocationCard } from '../components/LocationCard';
import { ScrollRow } from '../components/ScrollRow';
import { Icon } from '../components/icons';
import { CATEGORY_ICON } from './Home';
import { haversine } from '../tour/geo';
import { useTour } from '../tour/TourContext';
import { useUserPosition } from './usePosition';

/** UI02: tìm kiếm (FR-07), lọc (FR-08), sắp xếp theo khoảng cách (FR-09). */
export function Places() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const [q, setQ] = useState(text);
  const category = params.get('category') ?? '';
  const nearMe = params.get('sort') === 'near';
  const { data: cats } = useCategories();
  const { data, isLoading, isError, refetch } = useLocations(i18n.language, { q, category });
  const { position, error } = useUserPosition(nearMe);
  const { nowPlaying } = useTour();

  // Debounce 300 ms khi gõ
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(text.trim());
      const next = new URLSearchParams(params);
      if (text.trim()) next.set('q', text.trim());
      else next.delete('q');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const items = useMemo(() => {
    const list = (data?.items ?? []).map((l) => ({ l, d: position && l.latitude !== null ? haversine(position, { lat: l.latitude, lng: l.longitude! }) : null }));
    if (nearMe && position) list.sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity));
    return list;
  }, [data, nearMe, position]);

  return (
    <>
      <header className="page-intro">
        <h1>{t('places.title')}</h1>
      </header>
      <label className="search-field">
        <span className="sr-only">{t('search.placeholder')}</span>
        <Icon name="search" size={20} />
        <input className="search" type="search" placeholder={t('search.placeholder')} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <ScrollRow className="chips" role="toolbar">
        <button className={`chip ${!category ? 'on' : ''}`} onClick={() => setParam('category', null)}>{t('filter.all')}</button>
        {cats?.items.map((c) => (
          <button key={c.code} className={`chip ${category === c.code ? 'on' : ''}`} onClick={() => setParam('category', c.code)}>
            <Icon name={CATEGORY_ICON[c.code] ?? 'pin'} size={16} />{t(`category.${c.code}`, { defaultValue: c.name })}
          </button>
        ))}
      </ScrollRow>
      <div className="row list-meta">
        <span className="muted">{t('list.results', { count: items.length })}</span>
        <button className={`chip ${nearMe ? 'on' : ''}`} onClick={() => setParam('sort', nearMe ? null : 'near')}><Icon name="gps" size={16} />{t('sort.nearMe')}</button>
      </div>
      {nearMe && error && <div className="notice">{error === 'denied' ? t('gps.denied') : t('gps.unavailable')}</div>}
      {isLoading && <div className="grid">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" />)}</div>}
      {isError && <div className="notice error">{t('common.error')} <button className="btn small" onClick={() => void refetch()}>{t('common.retry')}</button></div>}
      {!isLoading && !isError && items.length === 0 && <div className="empty"><Icon name="search" size={30} /><p>{t('list.empty')}</p></div>}
      <div className="grid" style={{ marginTop: 10 }}>
        {items.map(({ l, d }) => <LocationCard key={l.code} item={l} distance={d} playing={nowPlaying?.code === l.code} />)}
      </div>
    </>
  );
}

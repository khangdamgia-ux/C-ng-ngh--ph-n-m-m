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

/** Dây đèn lồng treo trên ảnh hero – hình ảnh đặc trưng nhất của phố Hội. */
function LanternString() {
  const colors = ['#F07B2E', '#F2B544', '#E2502B', '#F7A23B', '#F07B2E', '#F2B544', '#E2502B', '#F7A23B', '#F07B2E'];
  return (
    <svg className="lanterns" viewBox="0 0 1000 120" preserveAspectRatio="xMidYMin slice" aria-hidden>
      <path d="M-10 8 Q 500 70 1010 8" fill="none" stroke="rgba(43,26,16,.55)" strokeWidth="2" />
      {colors.map((c, i) => {
        const x = 70 + i * 107;
        const y = 8 + 62 * (1 - ((x - 500) / 510) ** 2);
        const len = 10 + (i % 3) * 8;
        return (
          <g key={i} className="lantern" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${i * -0.7}s` }}>
            <line x1={x} y1={y} x2={x} y2={y + len} stroke="rgba(43,26,16,.55)" strokeWidth="1.5" />
            <rect x={x - 7} y={y + len - 1} width="14" height="5" rx="1.5" fill="#5a2a14" />
            <ellipse cx={x} cy={y + len + 20} rx="16" ry="19" fill={c} />
            <path d={`M${x - 16} ${y + len + 20}h32M${x} ${y + len + 1}v38`} stroke="rgba(90,42,20,.35)" strokeWidth="1.2" />
            <rect x={x - 7} y={y + len + 37} width="14" height="5" rx="1.5" fill="#5a2a14" />
            <line x1={x} y1={y + len + 42} x2={x} y2={y + len + 54} stroke="#E2502B" strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}

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

  // Danh mục + số địa điểm, lấy từ chính danh sách đang công khai (ẩn/xóa trong Admin là tự cập nhật).
  const themes = useMemo(() => {
    const m = new Map<string, { code: string; name: string; count: number }>();
    for (const l of data?.items ?? []) {
      const e = m.get(l.category.code) ?? { code: l.category.code, name: l.category.name, count: 0 };
      e.count += 1;
      m.set(l.category.code, e);
    }
    return [...m.values()];
  }, [data]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(text.trim() ? `/places?q=${encodeURIComponent(text.trim())}` : '/places');
  };

  return (
    <>
      <section className="hero">
        <img className="hero-img" src="/hero-hoian.png" alt="Chùa Cầu – Phố cổ Hội An" width={447} height={447} fetchPriority="high" />
        <LanternString />
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

      {themes.length > 0 && (
        <section className="block">
          <h2 className="section-title">{t('home.themes')}</h2>
          <div className="themes">
            {themes.map((c) => (
              <Link key={c.code} to={`/places?category=${c.code}`} className="theme">
                <span className="theme-ico"><Icon name={CATEGORY_ICON[c.code] ?? 'pin'} size={24} /></span>
                <b>{t(`category.${c.code}`, { defaultValue: c.name })}</b>
                <small>{t('list.results', { count: c.count })}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

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

      <section className="block how">
        <h2 className="section-title">{t('home.howTitle')}</h2>
        <ol className="steps">
          {(['1', '2', '3'] as const).map((n) => (
            <li key={n}>
              <span className="step-n">{n}</span>
              <div>
                <b>{t(`home.how${n}t`)}</b>
                <p>{t(`home.how${n}d`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

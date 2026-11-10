import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from './ErrorBoundary';
import { GpsPill } from './GpsPill';
import { LangSelect } from './LangSelect';
import { TourBar } from './TourBar';
import { usePageTitle } from './usePageTitle';

const ICONS: Record<string, JSX.Element> = {
  home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  places: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.3" /></>,
  map: <path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2zM9 4v14M15 6v14" />,
  favorites: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />,
  history: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 1.8" /></>,
};

const NavIcon = ({ name }: { name: string }) => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden>{ICONS[name]}</svg>
);

export function Layout() {
  const { t } = useTranslation();
  const nav = [
    ['/', 'home', t('nav.home')],
    ['/places', 'places', t('nav.places')],
    ['/map', 'map', t('nav.map')],
    ['/favorites', 'favorites', t('nav.favorites')],
    ['/history', 'history', t('nav.history')],
  ] as const;
  const { pathname } = useLocation();
  // Trang chi tiết /l/:code tự đặt tiêu đề theo tên di tích; các trang khác lấy theo menu.
  const current = nav.find(([to]) => (to === '/' ? pathname === '/' : pathname.startsWith(to)));
  usePageTitle(pathname.startsWith('/l/') ? null : current && current[0] !== '/' ? current[2] : '');
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <Link to="/" className="brand"><img src="/favicon.svg" alt="" />{t('app.name')}</Link>
          <nav className="topnav" aria-label="main">
            {nav.map(([to, , label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
          </nav>
          <div className="topbar-right">
            <GpsPill />
            <LangSelect />
          </div>
        </div>
      </header>
      <main>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="site-foot">
        <div className="foot-brand"><img src="/favicon.svg" alt="" width={28} height={28} /><b>{t('app.name')}</b></div>
        <p>{t('footer.tagline')}</p>
        <p className="foot-note">{t('privacy.note')}</p>
      </footer>
      <ErrorBoundary fallback={null}>
        <TourBar />
      </ErrorBoundary>
      <nav className="bottomnav" aria-label="main">
        {nav.map(([to, ico, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <NavIcon name={ico} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

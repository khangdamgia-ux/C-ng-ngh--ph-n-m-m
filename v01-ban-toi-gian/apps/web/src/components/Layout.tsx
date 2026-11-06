import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from './ErrorBoundary';
import { TourBar } from './TourBar';
import { usePageTitle } from './usePageTitle';

const ICONS: Record<string, JSX.Element> = {
  home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  places: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.3" /></>,
};

const NavIcon = ({ name }: { name: string }) => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden>{ICONS[name]}</svg>
);

export function Layout() {
  const { t } = useTranslation();
  const nav = [
    ['/', 'home', t('nav.home')],
    ['/places', 'places', t('nav.places')],
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

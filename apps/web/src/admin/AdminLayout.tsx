import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Icon, type IconName } from './icons';
import { usePageTitle } from '../components/usePageTitle';

const GROUPS: Array<{ title: string; items: Array<{ to: string; label: string; ico: IconName; end?: boolean; superOnly?: boolean }> }> = [
  { title: 'Tổng quan', items: [{ to: '/admin', label: 'Dashboard', ico: 'dashboard', end: true }, { to: '/admin/stats', label: 'Thống kê truy cập', ico: 'stats' }] },
  { title: 'Nội dung', items: [{ to: '/admin/locations', label: 'Địa điểm & thuyết minh', ico: 'pin' }, { to: '/admin/languages', label: 'Ngôn ngữ', ico: 'globe' }] },
  { title: 'Hệ thống', items: [{ to: '/admin/accounts', label: 'Tài khoản', ico: 'users', superOnly: true }] },
];

function adminTitle(path: string) {
  if (path === '/admin/locations/new') return 'Thêm địa điểm';
  if (/^\/admin\/locations\/\d+/.test(path)) return 'Sửa địa điểm';
  const all = GROUPS.flatMap((g) => g.items);
  return all.find((i) => (i.end ? path === i.to || path === `${i.to}/` : path.startsWith(i.to)))?.label ?? '';
}

export function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const loc = useLocation();
  usePageTitle(adminTitle(loc.pathname), 'admin');
  if (loading) return <div className="empty">Đang tải…</div>;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  return (
    <div className="admin">
      <aside>
        <div className="lg">
          <img src="/favicon.svg" alt="" width={36} height={36} />
          <div><b>HoiAn Guide</b><small>Quản trị nội dung</small></div>
        </div>
        <nav>
          {GROUPS.map((g) => {
            const items = g.items.filter((i) => !i.superOnly || user.role === 'SUPER_ADMIN');
            if (!items.length) return null;
            return (
              <div key={g.title} className="nav-group">
                <div className="nav-title">{g.title}</div>
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end}>
                    <Icon name={i.ico} />
                    <span>{i.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="aside-foot">
          <a href="/" target="_blank" rel="noreferrer"><Icon name="external" /><span>Xem website</span></a>
          <div className="me">
            <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
            <div><b>{user.username}</b><small>{user.role === 'SUPER_ADMIN' ? 'Quản trị viên cấp cao' : 'Biên tập viên'}</small></div>
            <button onClick={logout} title="Đăng xuất" aria-label="Đăng xuất"><Icon name="logout" size={16} /></button>
          </div>
        </div>
      </aside>
      <section className="content">
        <Outlet />
      </section>
    </div>
  );
}

import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Detail } from './pages/Detail';
import { Favorites } from './pages/Favorites';
import { HistoryPage } from './pages/History';
import { Home } from './pages/Home';
import { MapPage } from './pages/MapPage';
import { NotFound } from './pages/NotFound';
import { Places } from './pages/Places';

// Khu Quản trị chỉ tải khi vào /admin: khách tham quan không phải tải mã của Admin.
const AdminLayout = lazy(() => import('./admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const Accounts = lazy(() => import('./admin/Accounts').then((m) => ({ default: m.Accounts })));
const Dashboard = lazy(() => import('./admin/Dashboard').then((m) => ({ default: m.Dashboard })));
const Languages = lazy(() => import('./admin/Languages').then((m) => ({ default: m.Languages })));
const LocationEdit = lazy(() => import('./admin/LocationEdit').then((m) => ({ default: m.LocationEdit })));
const Locations = lazy(() => import('./admin/Locations').then((m) => ({ default: m.Locations })));
const Login = lazy(() => import('./admin/Login').then((m) => ({ default: m.Login })));
const Stats = lazy(() => import('./admin/Stats').then((m) => ({ default: m.Stats })));

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="places" element={<Places />} />
        <Route path="l/:code" element={<Detail />} />
        <Route path="map" element={<MapPage />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route
        path="admin/login"
        element={
          <Suspense fallback={<AdminLoading />}>
            <Login />
          </Suspense>
        }
      />
      <Route
        path="admin"
        element={
          <Suspense fallback={<AdminLoading />}>
            <AdminLayout />
          </Suspense>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="locations" element={<Locations />} />
        <Route path="locations/:id" element={<LocationEdit />} />
        <Route path="languages" element={<Languages />} />
        <Route path="stats" element={<Stats />} />
        <Route path="accounts" element={<Accounts />} />
      </Route>
    </Routes>
  );
}

function AdminLoading() {
  return (
    <p className="admin-loading" role="status">
      Đang tải…
    </p>
  );
}
